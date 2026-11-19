import { randomBytes } from 'crypto';
import { prisma } from '@vaqt/db';
import { SmsQueueService } from '../auth/sms/sms-queue.service';
import { KvService } from '../common/kv/kv.service';
import { SettingsService } from '../settings/settings.service';
import { MemorySettingsStore } from '../settings/settings.store';
import { BaleLinkService } from '../messenger/bale-link.service';
import { MockMessengerAdapter } from '../messenger/mock-messenger.adapter';
import { fakeConfig } from '../test-support/fake-config';
import { NotificationDispatcher } from './notification.dispatcher';

const HOUR = 3_600_000;

function uniquePhone(): string {
  return `+9899${String(Date.now()).slice(-4)}${String(
    Math.floor(Math.random() * 10000),
  ).padStart(4, '0')}`;
}

describe('NotificationDispatcher (real Postgres + Redis)', () => {
  const userIds: string[] = [];
  let redis: KvService;
  let messenger: MockMessengerAdapter;
  let smsJobs: {
    phone: string;
    templateId: string;
    params: Record<string, string>;
  }[];
  let dispatcher: NotificationDispatcher;
  let links: BaleLinkService;

  beforeEach(() => {
    const config = fakeConfig({
      WEB_ORIGIN: 'https://vaqt.me',
    });
    redis = new KvService();
    messenger = new MockMessengerAdapter();
    smsJobs = [];
    const sms = {
      enqueueNotification: (job: (typeof smsJobs)[number]) => {
        smsJobs.push(job);
        return Promise.resolve();
      },
    } as unknown as SmsQueueService;
    const settings = new SettingsService(config, new MemorySettingsStore());
    links = new BaleLinkService(redis, settings);
    dispatcher = new NotificationDispatcher(
      messenger,
      links,
      sms,
      redis,
      config,
      settings,
    );
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

  async function setup(opts: { bale?: boolean } = {}) {
    const provider = await prisma.user.create({
      data: {
        phone: uniquePhone(),
        displayName: 'علی نیک‌پور',
        username: `n${randomBytes(5).toString('hex')}`,
      },
    });
    const booker = await prisma.user.create({
      data: { phone: uniquePhone(), displayName: 'سارا' },
    });
    userIds.push(provider.id, booker.id);
    const service = await prisma.serviceType.create({
      data: {
        userId: provider.id,
        name: 'مشاوره',
        durationMinutes: 60,
        mode: 'online',
      },
    });
    let chatId: string | null = null;
    if (opts.bale) {
      chatId = `chat-${randomBytes(4).toString('hex')}`;
      await prisma.messengerBinding.create({
        data: { userId: provider.id, platform: 'bale', chatId },
      });
    }
    const makeBooking = (
      startInMs: number,
      extra: Partial<{ status: string; decidedAt: Date | null }> = {},
    ) =>
      prisma.booking.create({
        data: {
          providerId: provider.id,
          bookerId: booker.id,
          serviceId: service.id,
          serviceName: service.name,
          durationMinutes: 60,
          startAt: new Date(Date.now() + startInMs),
          endAt: new Date(Date.now() + startInMs + HOUR),
          bookerName: 'سارا احمدی',
          note: 'سؤال برند',
          cancelToken: randomBytes(24).toString('base64url'),
          status: extra.status ?? 'PENDING',
          decidedAt: extra.decidedAt ?? null,
        },
      });
    return { provider, booker, chatId, makeBooking };
  }

  describe('new booking', () => {
    it('messages the provider on Bale with confirm/reject buttons, and sends no SMS', async () => {
      const { chatId, makeBooking, booker } = await setup({ bale: true });
      const booking = await makeBooking(48 * HOUR);
      await dispatcher.handle({
        type: 'booking.created',
        bookingId: booking.id,
      });

      expect(messenger.sent).toHaveLength(1);
      const sent = messenger.sent[0];
      expect(sent.chatId).toBe(chatId);
      expect(sent.text).toContain('سارا احمدی');
      expect(sent.text).toContain(`0${booker.phone.slice(3)}`);
      expect(sent.keyboard?.[0].map((b) => b.callbackData)).toEqual([
        `bk:c:${booking.id}`,
        `bk:r:${booking.id}`,
      ]);
      expect(smsJobs).toHaveLength(0);
    });

    it('falls back to one SMS when the provider has not linked Bale', async () => {
      const { provider, makeBooking } = await setup();
      const booking = await makeBooking(48 * HOUR);
      await dispatcher.handle({
        type: 'booking.created',
        bookingId: booking.id,
      });
      expect(messenger.sent).toHaveLength(0);
      expect(smsJobs).toEqual([
        expect.objectContaining({
          phone: provider.phone,
          templateId: 'booking_new_for_provider',
        }),
      ]);
    });

    it('stops sending provider SMS after the daily cap', async () => {
      const { provider, makeBooking } = await setup();
      const day = new Date().toISOString().slice(0, 10);
      await redis.set(redis.key('notif-sms', provider.id, day), '10', 86_400);
      const booking = await makeBooking(48 * HOUR);
      await dispatcher.handle({
        type: 'booking.created',
        bookingId: booking.id,
      });
      expect(smsJobs).toHaveLength(0);
    });

    it('stays silent if the booking was already decided by the time the job runs', async () => {
      const { makeBooking } = await setup({ bale: true });
      const booking = await makeBooking(48 * HOUR, {
        status: 'CONFIRMED',
        decidedAt: new Date(),
      });
      await dispatcher.handle({
        type: 'booking.created',
        bookingId: booking.id,
      });
      expect(messenger.sent).toHaveLength(0);
      expect(smsJobs).toHaveLength(0);
    });

    it('does nothing for a booking that no longer exists', async () => {
      await dispatcher.handle({ type: 'booking.created', bookingId: 'gone' });
      expect(messenger.sent).toHaveLength(0);
    });
  });

  describe('decisions and cancellations', () => {
    it('texts the booker when confirmed or rejected, with the no-login link', async () => {
      const { booker, makeBooking } = await setup();
      const confirmed = await makeBooking(48 * HOUR, {
        status: 'CONFIRMED',
        decidedAt: new Date(),
      });
      const rejected = await makeBooking(72 * HOUR, {
        status: 'REJECTED',
        decidedAt: new Date(),
      });
      await dispatcher.handle({
        type: 'booking.decided',
        bookingId: confirmed.id,
      });
      await dispatcher.handle({
        type: 'booking.decided',
        bookingId: rejected.id,
      });
      expect(smsJobs.map((j) => j.templateId)).toEqual([
        'booking_confirmed',
        'booking_rejected',
      ]);
      expect(smsJobs[0].phone).toBe(booker.phone);
      expect(smsJobs[0].params.LINK).toBe(
        `https://vaqt.me/b/${confirmed.cancelToken}`,
      );
    });

    it('tells the provider on Bale when the booker cancels', async () => {
      const { chatId, makeBooking } = await setup({ bale: true });
      const booking = await makeBooking(48 * HOUR, {
        status: 'CANCELED',
        decidedAt: new Date(),
      });
      await dispatcher.handle({
        type: 'booking.canceled',
        bookingId: booking.id,
        by: 'booker',
      });
      expect(messenger.sent[0].chatId).toBe(chatId);
      expect(messenger.sent[0].text).toContain('لغو');
      expect(smsJobs).toHaveLength(0);
    });

    it('texts the booker when the provider cancels', async () => {
      const { booker, makeBooking } = await setup({ bale: true });
      const booking = await makeBooking(48 * HOUR, {
        status: 'CANCELED',
        decidedAt: new Date(),
      });
      await dispatcher.handle({
        type: 'booking.canceled',
        bookingId: booking.id,
        by: 'provider',
      });
      expect(smsJobs).toEqual([
        expect.objectContaining({
          phone: booker.phone,
          templateId: 'booking_canceled_by_provider',
        }),
      ]);
      expect(messenger.sent).toHaveLength(0);
    });
  });

  describe('reminders', () => {
    it('sends the 24h reminder once, even when two scans run at the same time', async () => {
      const { makeBooking } = await setup();
      const decidedAt = new Date(Date.now() - 72 * HOUR);
      const booking = await makeBooking(20 * HOUR, {
        status: 'CONFIRMED',
        decidedAt,
      });
      const results = await Promise.all([
        dispatcher.scanReminders(),
        dispatcher.scanReminders(),
      ]);
      expect(results.reduce((n, r) => n + r.r24, 0)).toBe(1);
      expect(
        smsJobs.filter((j) => j.templateId === 'booking_reminder'),
      ).toHaveLength(1);
      const row = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
      });
      expect(row.reminder24SentAt).not.toBeNull();
      expect((await dispatcher.scanReminders()).r24).toBe(0);
    });

    it('does not send a 24h reminder for a booking confirmed inside that window', async () => {
      const { makeBooking } = await setup();
      const booking = await makeBooking(10 * HOUR, {
        status: 'CONFIRMED',
        decidedAt: new Date(Date.now() - HOUR),
      });
      expect((await dispatcher.scanReminders()).r24).toBe(0);
      expect(smsJobs).toHaveLength(0);
      const row = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
      });
      expect(row.reminder24SentAt).not.toBeNull(); // settled, never reconsidered
    });

    it('sends the 1h reminder to the booker by SMS and the provider on Bale, once', async () => {
      const { chatId, makeBooking } = await setup({ bale: true });
      await makeBooking(45 * 60_000, {
        status: 'CONFIRMED',
        decidedAt: new Date(Date.now() - 48 * HOUR),
      });
      const first = await dispatcher.scanReminders();
      const second = await dispatcher.scanReminders();
      expect(first.r1).toBe(1);
      expect(second.r1).toBe(0);
      expect(
        smsJobs.filter((j) => j.templateId === 'booking_reminder').length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        messenger.sent.filter(
          (m) => m.chatId === chatId && m.text.includes('تا یک ساعت'),
        ),
      ).toHaveLength(1);
    });

    it('ignores pending, canceled and past bookings', async () => {
      const { makeBooking } = await setup();
      await makeBooking(20 * HOUR, { status: 'PENDING' });
      await makeBooking(20 * HOUR, {
        status: 'CANCELED',
        decidedAt: new Date(Date.now() - 72 * HOUR),
      });
      await makeBooking(-2 * HOUR, {
        status: 'CONFIRMED',
        decidedAt: new Date(Date.now() - 72 * HOUR),
      });
      const r = await dispatcher.scanReminders();
      expect(r).toEqual({ r24: 0, r1: 0 });
      expect(smsJobs).toHaveLength(0);
    });
  });
});
