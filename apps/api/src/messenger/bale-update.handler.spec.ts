import { randomBytes } from 'crypto';
import { HttpStatus } from '@nestjs/common';
import { prisma } from '@vaqt/db';
import { BookingService } from '../booking/booking.service';
import { ErrorCode } from '../common/errors/error-codes';
import { KvService } from '../common/kv/kv.service';
import { fakeConfig } from '../test-support/fake-config';
import { SettingsService } from '../settings/settings.service';
import { MemorySettingsStore } from '../settings/settings.store';
import { BaleLinkService } from './bale-link.service';
import { BaleUpdateHandler } from './bale-update.handler';
import { MessengerController } from './messenger.controller';
import { baleMessagesFa } from './messenger.messages.fa';
import { MockMessengerAdapter } from './mock-messenger.adapter';
import { randomTestPhone } from '../test-support/test-db';

const HOUR = 3_600_000;

function uniquePhone(): string {
  return randomTestPhone();
}

describe('Bale linking and webhook (real Postgres + Redis)', () => {
  const userIds: string[] = [];
  let redis: KvService;
  let messenger: MockMessengerAdapter;
  let links: BaleLinkService;
  let handler: BaleUpdateHandler;
  const config = () =>
    fakeConfig({
      BALE_BOT_USERNAME: 'vaqt_bot',
      BALE_WEBHOOK_SECRET: 'super-secret-webhook-path-1234',
    });

  beforeEach(() => {
    const cfg = config();
    redis = new KvService();
    messenger = new MockMessengerAdapter();
    links = new BaleLinkService(
      redis,
      new SettingsService(cfg, new MemorySettingsStore()),
    );
    handler = new BaleUpdateHandler(links, new BookingService(), messenger);
  });

  afterEach(async () => {});

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { providerId: { in: userIds } } });
    await prisma.messengerBinding.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.serviceType.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  const makeUser = async (displayName = 'متخصص') => {
    const u = await prisma.user.create({
      data: { phone: uniquePhone(), displayName },
    });
    userIds.push(u.id);
    return u;
  };
  const chatId = () => `c${randomBytes(4).toString('hex')}`;

  describe('linking', () => {
    it('creates a deep link and binds the chat when the user sends /start CODE', async () => {
      const user = await makeUser('علی');
      const offer = await links.createLinkCode(user.id);
      expect(offer.url).toBe(`https://ble.ir/vaqt_bot?start=${offer.code}`);
      const chat = chatId();
      await handler.handle({
        message: { chat: { id: chat }, text: `/start ${offer.code}` },
      });
      expect(await links.getChatId(user.id)).toBe(chat);
      expect(messenger.sent[0].text).toBe(baleMessagesFa.linked('علی'));
    });

    it('accepts a bare code and a lowercase code', async () => {
      const user = await makeUser();
      const { code } = await links.createLinkCode(user.id);
      const chat = chatId();
      await handler.handle({
        message: { chat: { id: chat }, text: code.toLowerCase() },
      });
      expect(await links.isBound(user.id)).toBe(true);
    });

    it('works exactly once: a replayed or wrong code binds nothing', async () => {
      const user = await makeUser();
      const attacker = chatId();
      const { code } = await links.createLinkCode(user.id);
      await handler.handle({
        message: { chat: { id: chatId() }, text: `/start ${code}` },
      });
      await handler.handle({
        message: { chat: { id: attacker }, text: `/start ${code}` },
      });
      await handler.handle({
        message: { chat: { id: attacker }, text: '/start AAAAAAAA' },
      });
      expect(await links.findUserIdByChat(attacker)).toBeNull();
      expect(
        messenger.sent.filter((m) => m.chatId === attacker).map((m) => m.text),
      ).toEqual([baleMessagesFa.linkInvalid, baleMessagesFa.linkInvalid]);
    });

    it('moves a chat to the newest account instead of serving two users', async () => {
      const [a, b] = [await makeUser(), await makeUser()];
      const chat = chatId();
      for (const u of [a, b]) {
        const { code } = await links.createLinkCode(u.id);
        await handler.handle({
          message: { chat: { id: chat }, text: `/start ${code}` },
        });
      }
      expect(await links.findUserIdByChat(chat)).toBe(b.id);
      expect(await links.isBound(a.id)).toBe(false);
    });

    it('answers a bare /start with help and ignores junk updates without throwing', async () => {
      const chat = chatId();
      await handler.handle({ message: { chat: { id: chat }, text: '/start' } });
      expect(messenger.sent[0].text).toBe(baleMessagesFa.help);
      await expect(handler.handle({})).resolves.toBeUndefined();
      await expect(
        handler.handle({ callback_query: { id: 'x', data: 'garbage' } }),
      ).resolves.toBeUndefined();
    });

    it('unlinks', async () => {
      const user = await makeUser();
      const { code } = await links.createLinkCode(user.id);
      await handler.handle({ message: { chat: { id: chatId() }, text: code } });
      await links.unlink(user.id);
      expect(await links.isBound(user.id)).toBe(false);
    });
  });

  describe('confirm/reject buttons', () => {
    async function pendingFor(providerChat: string | null) {
      const provider = await makeUser();
      const booker = await makeUser('سارا');
      if (providerChat) {
        await prisma.messengerBinding.create({
          data: { userId: provider.id, platform: 'bale', chatId: providerChat },
        });
      }
      const service = await prisma.serviceType.create({
        data: {
          userId: provider.id,
          name: 'مشاوره',
          durationMinutes: 60,
          mode: 'online',
        },
      });
      const booking = await prisma.booking.create({
        data: {
          providerId: provider.id,
          bookerId: booker.id,
          serviceId: service.id,
          serviceName: 'مشاوره',
          durationMinutes: 60,
          startAt: new Date(Date.now() + 48 * HOUR),
          endAt: new Date(Date.now() + 49 * HOUR),
          bookerName: 'سارا',
          cancelToken: randomBytes(24).toString('base64url'),
        },
      });
      return { provider, booking };
    }
    const click = (chat: string, data: string) => ({
      callback_query: {
        id: 'cb1',
        data,
        message: { message_id: 7, text: 'متن اصلی', chat: { id: chat } },
      },
    });

    it('lets the linked provider confirm, edits the message and clears the buttons', async () => {
      const chat = chatId();
      const { booking } = await pendingFor(chat);
      await handler.handle(click(chat, `bk:c:${booking.id}`));
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .status,
      ).toBe('CONFIRMED');
      expect(messenger.edits[0]).toMatchObject({ chatId: chat, messageId: 7 });
      expect(messenger.edits[0].text).toContain('متن اصلی');
      expect(messenger.edits[0].text).toContain('تأیید شد');
    });

    it('rejects via the reject button', async () => {
      const chat = chatId();
      const { booking } = await pendingFor(chat);
      await handler.handle(click(chat, `bk:r:${booking.id}`));
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .status,
      ).toBe('REJECTED');
    });

    it("never lets another linked user decide someone else's booking", async () => {
      const { booking } = await pendingFor(chatId());
      const strangerChat = chatId();
      const stranger = await makeUser();
      await prisma.messengerBinding.create({
        data: { userId: stranger.id, platform: 'bale', chatId: strangerChat },
      });
      await handler.handle(click(strangerChat, `bk:c:${booking.id}`));
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .status,
      ).toBe('PENDING');
      expect(messenger.callbackAnswers[0].text).toBe(
        baleMessagesFa.genericError,
      );
    });

    it('refuses a click from a chat that is not linked to anyone', async () => {
      const { booking } = await pendingFor(chatId());
      await handler.handle(click(chatId(), `bk:c:${booking.id}`));
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .status,
      ).toBe('PENDING');
      expect(messenger.callbackAnswers[0].text).toBe(baleMessagesFa.notLinked);
    });

    it('says so when the booking was already decided', async () => {
      const chat = chatId();
      const { booking } = await pendingFor(chat);
      await handler.handle(click(chat, `bk:c:${booking.id}`));
      await handler.handle(click(chat, `bk:r:${booking.id}`));
      expect(messenger.callbackAnswers.at(-1)?.text).toBe(
        baleMessagesFa.notPending,
      );
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .status,
      ).toBe('CONFIRMED');
    });
  });

  describe('webhook endpoint secret', () => {
    it('404s on a wrong secret without touching the handler, and accepts the right one', async () => {
      const spy = jest.spyOn(handler, 'handle').mockResolvedValue();
      const controller = new MessengerController(
        links,
        handler,
        new SettingsService(config(), new MemorySettingsStore()),
      );
      await expect(controller.webhook('nope', {})).rejects.toMatchObject({
        response: { code: ErrorCode.NOT_FOUND },
        status: HttpStatus.NOT_FOUND,
      });
      expect(spy).not.toHaveBeenCalled();
      await expect(
        controller.webhook('super-secret-webhook-path-1234', {}),
      ).resolves.toEqual({ ok: true });
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('404s for everyone when no secret is configured', async () => {
      const controller = new MessengerController(
        links,
        handler,
        new SettingsService(fakeConfig({}), new MemorySettingsStore()),
      );
      await expect(controller.webhook('', {})).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });
});
