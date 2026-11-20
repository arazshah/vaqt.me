import { randomBytes } from 'crypto';
import { prisma } from '@vaqt/db';
import { tehranDateKey } from '@vaqt/shared';
import { BookingDraftService } from '../booking/booking-draft.service';
import { BookingService } from '../booking/booking.service';
import { KvService } from '../common/kv/kv.service';
import { SettingsService } from '../settings/settings.service';
import { MemorySettingsStore } from '../settings/settings.store';
import { fakeConfig } from '../test-support/fake-config';
import { randomTestPhone } from '../test-support/test-db';
import { BaleBookingFlow } from './bale-booking.flow';
import { BaleLinkService } from './bale-link.service';
import { BaleUpdateHandler } from './bale-update.handler';
import { baleMessagesFa as msg } from './messenger.messages.fa';
import { MockMessengerAdapter } from './mock-messenger.adapter';

describe('booking confirmed through the Bale bot (real Postgres)', () => {
  const cfg = fakeConfig({
    BALE_BOT_USERNAME: 'vaqt_bot',
    BALE_PROVIDER: 'mock',
    WEB_ORIGIN: 'https://vaqt.test',
  });
  const kv = new KvService();
  const messenger = new MockMessengerAdapter();
  const settings = new SettingsService(cfg, new MemorySettingsStore());
  const links = new BaleLinkService(kv, settings);
  const booking = new BookingService();
  const drafts = new BookingDraftService(kv, settings, booking);
  const flow = new BaleBookingFlow(links, booking, drafts, kv, cfg, messenger);
  const handler = new BaleUpdateHandler(links, booking, flow, messenger);
  const userIds: string[] = [];
  const chatId = () => `c${randomBytes(4).toString('hex')}`;
  const ip = () =>
    `10.${String(randomBytes(1)[0])}.${String(randomBytes(1)[0])}.${String(randomBytes(1)[0])}`;

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { providerId: { in: userIds } } });
    await prisma.messengerBinding.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.serviceType.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.card.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.availabilityRule.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function setup() {
    const username = `p${randomBytes(5).toString('hex')}`;
    const provider = await prisma.user.create({
      data: { phone: randomTestPhone(), displayName: 'دکتر', username },
    });
    userIds.push(provider.id);
    await prisma.card.create({
      data: {
        userId: provider.id,
        bookingEnabled: true,
        minNoticeHours: 0,
        maxDaysAhead: 14,
      },
    });
    for (let weekday = 0; weekday < 7; weekday++) {
      await prisma.availabilityRule.create({
        data: { userId: provider.id, weekday, startMinute: 0, endMinute: 1440 },
      });
    }
    const service = await prisma.serviceType.create({
      data: {
        userId: provider.id,
        name: 'مشاوره',
        durationMinutes: 30,
        mode: 'online',
      },
    });
    const days = await booking.getAvailability(username, service.id);
    const day = days.days.find((d) => d.slots.length > 2);
    if (!day) throw new Error('no free day in test setup');
    const startAt = day.slots[Math.floor(day.slots.length / 2)];
    return {
      provider,
      username,
      service,
      startAt,
      date: tehranDateKey(new Date(startAt)),
    };
  }

  const draftInput = (s: Awaited<ReturnType<typeof setup>>, name = 'سارا') => ({
    username: s.username,
    serviceId: s.service.id,
    startAt: s.startAt,
    name,
    note: null,
  });

  it('turns a draft plus the sender’s own contact into a verified booker and a PENDING booking', async () => {
    const s = await setup();
    const offer = await drafts.create(draftInput(s), ip());
    expect(offer.url).toBe(`https://ble.ir/vaqt_bot?start=bk_${offer.token}`);
    expect(await drafts.status(offer.token)).toEqual({ status: 'waiting' });

    const chat = chatId();
    const phone = randomTestPhone();
    await handler.handle({
      message: { chat: { id: chat }, text: `/start bk_${offer.token}` },
    });
    expect(messenger.sent.at(-1)?.contactButton).toBe(msg.shareContactButton);

    await handler.handle({
      message: {
        chat: { id: chat },
        from: { id: chat },
        contact: { phone_number: phone.slice(1), user_id: chat },
      },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    userIds.push(user.id);
    expect(user.phoneVerifiedAt).not.toBeNull();
    const b = await prisma.booking.findFirstOrThrow({
      where: { bookerId: user.id },
    });
    expect(b.status).toBe('PENDING');
    expect(await links.getChatId(user.id)).toBe(chat);
    const status = await drafts.status(offer.token);
    expect(status).toEqual({ status: 'done', cancelToken: b.cancelToken });
    expect(messenger.sent.at(-1)?.text).toContain(
      `https://vaqt.test/b/${b.cancelToken}`,
    );
  });

  it('rejects a contact that belongs to someone else, and keeps the draft usable', async () => {
    const s = await setup();
    const offer = await drafts.create(draftInput(s), ip());
    const chat = chatId();
    await handler.handle({
      message: { chat: { id: chat }, text: `/start bk_${offer.token}` },
    });
    await handler.handle({
      message: {
        chat: { id: chat },
        from: { id: chat },
        contact: { phone_number: randomTestPhone(), user_id: 'someone-else' },
      },
    });
    expect(messenger.sent.at(-1)?.text).toBe(msg.contactNotOwn);
    expect((await drafts.status(offer.token)).status).toBe('waiting');
    expect(
      await prisma.booking.count({ where: { providerId: s.provider.id } }),
    ).toBe(0);
  });

  it('a draft works exactly once', async () => {
    const s = await setup();
    const offer = await drafts.create(draftInput(s), ip());
    expect(await drafts.consume(offer.token)).not.toBeNull();
    expect(await drafts.consume(offer.token)).toBeNull();
    const chat = chatId();
    await handler.handle({
      message: { chat: { id: chat }, text: `/start bk_${offer.token}` },
    });
    expect(messenger.sent.at(-1)?.text).toBe(msg.draftInvalid);
  });

  it('does not steal or replace an existing chat binding', async () => {
    const s = await setup();
    const owner = await prisma.user.create({
      data: {
        phone: randomTestPhone(),
        displayName: 'x',
        phoneVerifiedAt: new Date(),
      },
    });
    userIds.push(owner.id);
    const ownerChat = chatId();
    await links.bindIfFree(owner.id, ownerChat);
    await links.bindIfFree(owner.id, chatId());
    expect(await links.getChatId(owner.id)).toBe(ownerChat);
    // The linked chat gets a confirm button instead of a contact request.
    const offer = await drafts.create(draftInput(s), ip());
    await handler.handle({
      message: { chat: { id: ownerChat }, text: `/start bk_${offer.token}` },
    });
    expect(messenger.sent.at(-1)?.keyboard?.[0][0].callbackData).toBe(
      `bd:${offer.token}`,
    );
    await handler.handle({
      callback_query: {
        id: 'cb',
        data: `bd:${offer.token}`,
        message: { message_id: 1, chat: { id: ownerChat } },
      },
    });
    expect(await prisma.booking.count({ where: { bookerId: owner.id } })).toBe(
      1,
    );
  });

  it('refuses drafts for a taken slot and rate-limits per IP', async () => {
    const s = await setup();
    await prisma.booking.create({
      data: {
        providerId: s.provider.id,
        bookerId: s.provider.id,
        serviceId: s.service.id,
        serviceName: 'x',
        durationMinutes: 30,
        startAt: new Date(s.startAt),
        endAt: new Date(new Date(s.startAt).getTime() + 1_800_000),
        bookerName: 'x',
        cancelToken: randomBytes(24).toString('base64url'),
      },
    });
    await expect(drafts.create(draftInput(s), ip())).rejects.toMatchObject({
      code: 'SLOT_UNAVAILABLE',
    });
    const same = ip();
    const s2 = await setup();
    for (let i = 0; i < 10; i++) await drafts.create(draftInput(s2), same);
    await expect(drafts.create(draftInput(s2), same)).rejects.toMatchObject({
      code: 'TOO_MANY_ATTEMPTS',
    });
  });

  it('lets the booker cancel from the bot, but not a stranger', async () => {
    const s = await setup();
    const offer = await drafts.create(draftInput(s), ip());
    const chat = chatId();
    const phone = randomTestPhone();
    await handler.handle({
      message: { chat: { id: chat }, text: `/start bk_${offer.token}` },
    });
    await handler.handle({
      message: {
        chat: { id: chat },
        from: { id: chat },
        contact: { phone_number: phone, user_id: chat },
      },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    userIds.push(user.id);
    const b = await prisma.booking.findFirstOrThrow({
      where: { bookerId: user.id },
    });
    const click = (c: string) => ({
      callback_query: {
        id: 'cb',
        data: `bk:x:${b.id}`,
        message: { message_id: 2, text: 't', chat: { id: c } },
      },
    });
    await handler.handle(click(chatId()));
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status,
    ).toBe('PENDING');
    await handler.handle(click(chat));
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status,
    ).toBe('CANCELED');
  });
});
