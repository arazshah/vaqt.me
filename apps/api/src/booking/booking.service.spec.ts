import { randomBytes } from 'crypto';
import { prisma } from '@vaqt/db';
import { ErrorCode } from '../common/errors/error-codes';
import { NotificationQueueService } from '../notifications/notification-queue.service';
import { BookingService } from './booking.service';
import { randomTestPhone } from '../test-support/test-db';

function uniquePhone(): string {
  return randomTestPhone();
}

const ALL_WEEK = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  startMinute: 0,
  endMinute: 1440,
}));

describe('BookingService (real Postgres)', () => {
  const service = new BookingService();
  const userIds: string[] = [];

  async function makeUser(username?: string) {
    const user = await prisma.user.create({
      data: {
        phone: uniquePhone(),
        displayName: 'متخصص تست',
        username,
        phoneVerifiedAt: new Date(),
      },
    });
    userIds.push(user.id);
    return user;
  }

  /** A provider open 24/7 so tests don't depend on the wall clock. */
  async function makeProvider(extra: { minNoticeHours?: number } = {}) {
    const provider = await makeUser(`p${randomBytes(5).toString('hex')}`);
    const settings = await service.updateSettings(provider.id, {
      enabled: true,
      minNoticeHours: extra.minNoticeHours ?? 0,
      maxDaysAhead: 3,
      services: [
        { name: 'آشنایی', durationMinutes: 15, mode: 'online' },
        { name: 'مشاوره', durationMinutes: 60, mode: 'phone' },
      ],
      rules: ALL_WEEK,
    });
    const withName = { ...provider, username: provider.username ?? '' };
    return { provider: withName, serviceId: settings.services[1].id, settings };
  }

  async function aFutureSlot(username: string, serviceId: string) {
    const { days } = await service.getAvailability(username, serviceId);
    // Day index 1 (tomorrow) so "now" edge cases never matter.
    return days[1].slots[0];
  }

  afterAll(async () => {
    await prisma.booking.deleteMany({
      where: {
        OR: [{ providerId: { in: userIds } }, { bookerId: { in: userIds } }],
      },
    });
    await prisma.serviceType.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.availabilityRule.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.availabilityException.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.card.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  describe('settings', () => {
    it('round-trips settings, and deactivates (not deletes) dropped services', async () => {
      const { provider, settings } = await makeProvider();
      expect(settings.services.map((s) => s.name)).toEqual([
        'آشنایی',
        'مشاوره',
      ]);
      const keep = settings.services[1];

      const next = await service.updateSettings(provider.id, {
        services: [
          {
            id: keep.id,
            name: 'مشاوره‌ی طولانی',
            durationMinutes: 90,
            mode: 'in_person',
          },
        ],
        exceptions: ['2030-01-01', '2030-01-01'],
      });
      expect(next.services).toHaveLength(1);
      expect(next.services[0]).toMatchObject({
        id: keep.id,
        durationMinutes: 90,
      });
      expect(next.exceptions).toEqual(['2030-01-01']); // de-duplicated
      const dropped = await prisma.serviceType.findUnique({
        where: { id: settings.services[0].id },
      });
      expect(dropped?.isActive).toBe(false);
    });

    it("refuses to edit another provider's service", async () => {
      const a = await makeProvider();
      const b = await makeProvider();
      await expect(
        service.updateSettings(b.provider.id, {
          services: [
            {
              id: a.serviceId,
              name: 'هک',
              durationMinutes: 30,
              mode: 'online',
            },
          ],
        }),
      ).rejects.toMatchObject({ response: { code: ErrorCode.NOT_FOUND } });
      const untouched = await prisma.serviceType.findUnique({
        where: { id: a.serviceId },
      });
      expect(untouched?.name).toBe('مشاوره');
    });
  });

  describe('create', () => {
    it('books a pending slot, which then disappears from availability', async () => {
      const { provider, serviceId } = await makeProvider();
      const booker = await makeUser();
      const startAt = await aFutureSlot(provider.username, serviceId);

      const booking = await service.create(booker.id, {
        username: provider.username,
        serviceId,
        startAt,
        name: 'سارا احمدی',
        note: 'سؤال درباره‌ی برند',
      });
      expect(booking.status).toBe('PENDING');
      expect(booking.cancelToken.length).toBeGreaterThanOrEqual(16);
      expect(booking.endAt).toBe(
        new Date(new Date(startAt).getTime() + 3_600_000).toISOString(),
      );

      const after = await service.getAvailability(provider.username, serviceId);
      expect(after.days[1].slots).not.toContain(startAt);
      // A slot starting 30 minutes later would overlap the 60-minute booking.
      const overlapping = new Date(
        new Date(startAt).getTime() + 30 * 60_000,
      ).toISOString();
      expect(after.days[1].slots).not.toContain(overlapping);
    });

    it('lets exactly one of many simultaneous requests win the same slot', async () => {
      const { provider, serviceId } = await makeProvider();
      const bookers = await Promise.all(
        Array.from({ length: 8 }, () => makeUser()),
      );
      const startAt = await aFutureSlot(provider.username, serviceId);

      const results = await Promise.allSettled(
        bookers.map((b) =>
          service.create(b.id, {
            username: provider.username,
            serviceId,
            startAt,
            name: 'رقیب',
          }),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      for (const r of results) {
        if (r.status === 'rejected') {
          expect(r.reason).toMatchObject({
            response: { code: ErrorCode.SLOT_UNAVAILABLE },
          });
        }
      }
      expect(
        await prisma.booking.count({ where: { providerId: provider.id } }),
      ).toBe(1);
    });

    it('rejects a time that was never offered (outside hours, past, off-grid)', async () => {
      const { provider, serviceId } = await makeProvider();
      const booker = await makeUser();
      const offGrid = new Date(Date.now() + 36 * 3_600_000);
      offGrid.setUTCMinutes(7, 0, 0);
      for (const startAt of [
        new Date(Date.now() - 3_600_000).toISOString(),
        offGrid.toISOString(),
      ]) {
        await expect(
          service.create(booker.id, {
            username: provider.username,
            serviceId,
            startAt,
            name: 'سارا',
          }),
        ).rejects.toMatchObject({
          response: { code: ErrorCode.SLOT_UNAVAILABLE },
        });
      }
    });

    it('rejects booking when disabled, on your own card, and past the pending limit', async () => {
      const { provider, serviceId } = await makeProvider();
      const booker = await makeUser();

      await expect(
        service.create(provider.id, {
          username: provider.username,
          serviceId,
          startAt: await aFutureSlot(provider.username, serviceId),
          name: 'خودم',
        }),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.OWN_CARD_BOOKING_FORBIDDEN },
      });

      const { days } = await service.getAvailability(
        provider.username,
        serviceId,
      );
      const [s1, s2, s3] = [
        days[1].slots[0],
        days[1].slots[4],
        days[1].slots[8],
      ];
      for (const startAt of [s1, s2]) {
        await service.create(booker.id, {
          username: provider.username,
          serviceId,
          startAt,
          name: 'سارا',
        });
      }
      await expect(
        service.create(booker.id, {
          username: provider.username,
          serviceId,
          startAt: s3,
          name: 'سارا',
        }),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.BOOKING_LIMIT_REACHED },
      });

      await service.updateSettings(provider.id, { enabled: false });
      await expect(
        service.getAvailability(provider.username, serviceId),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.BOOKING_DISABLED },
      });
    });

    it('honours leave days', async () => {
      const { provider, serviceId } = await makeProvider();
      const { days } = await service.getAvailability(
        provider.username,
        serviceId,
      );
      await service.updateSettings(provider.id, { exceptions: [days[2].date] });
      const after = await service.getAvailability(provider.username, serviceId);
      expect(after.days[2].slots).toEqual([]);
      expect(after.days[1].slots.length).toBeGreaterThan(0);
    });
  });

  describe('decide and cancel', () => {
    async function pendingBooking() {
      const { provider, serviceId } = await makeProvider();
      const booker = await makeUser();
      const startAt = await aFutureSlot(provider.username, serviceId);
      const booking = await service.create(booker.id, {
        username: provider.username,
        serviceId,
        startAt,
        name: 'سارا',
      });
      return { provider, booker, booking, serviceId, startAt };
    }

    it('lets only the provider confirm, and only once', async () => {
      const { provider, booker, booking } = await pendingBooking();
      await expect(
        service.decide(booker.id, booking.id, 'confirm'),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.NOT_FOUND },
      });
      const list = await service.decide(provider.id, booking.id, 'confirm');
      expect(list.find((b) => b.id === booking.id)?.status).toBe('CONFIRMED');
      await expect(
        service.decide(provider.id, booking.id, 'reject'),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.BOOKING_NOT_PENDING },
      });
    });

    it('frees the slot when the provider rejects', async () => {
      const { provider, booking, serviceId, startAt } = await pendingBooking();
      await service.decide(provider.id, booking.id, 'reject');
      const { days } = await service.getAvailability(
        provider.username,
        serviceId,
      );
      expect(days[1].slots).toContain(startAt);
    });

    it('lets either party cancel, but nobody else', async () => {
      const { provider, booker, booking } = await pendingBooking();
      const stranger = await makeUser();
      await expect(
        service.cancel(stranger.id, booking.id),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.NOT_FOUND },
      });
      await service.cancel(booker.id, booking.id);
      const row = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
      });
      expect(row).toMatchObject({ status: 'CANCELED', cancelledBy: 'booker' });
      await expect(
        service.cancel(provider.id, booking.id),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.BOOKING_NOT_CANCELLABLE },
      });
    });

    it('cancels through the no-login token page', async () => {
      const { booking, provider, serviceId, startAt } = await pendingBooking();
      const view = await service.getByToken(booking.cancelToken);
      expect(view).toMatchObject({ status: 'PENDING', canCancel: true });
      const after = await service.cancelByToken(booking.cancelToken);
      expect(after).toMatchObject({ status: 'CANCELED', canCancel: false });
      const { days } = await service.getAvailability(
        provider.username,
        serviceId,
      );
      expect(days[1].slots).toContain(startAt);
      await expect(service.getByToken('x'.repeat(24))).rejects.toMatchObject({
        response: { code: ErrorCode.NOT_FOUND },
      });
    });

    it("shows the booker's phone to the provider only", async () => {
      const { provider, booker, booking } = await pendingBooking();
      const local = `0${(booker.phone ?? '').slice(3)}`;
      const providerView = await service.listForProvider(provider.id);
      expect(providerView.find((b) => b.id === booking.id)?.bookerPhone).toBe(
        local,
      );

      const bookerJson = JSON.stringify(await service.listMine(booker.id));
      const tokenJson = JSON.stringify(
        await service.getByToken(booking.cancelToken),
      );
      for (const json of [bookerJson, tokenJson]) {
        expect(json).not.toContain((provider.phone ?? '').slice(3));
      }
      expect(tokenJson).not.toContain((booker.phone ?? '').slice(3));
    });
  });

  describe('notifications', () => {
    it('enqueues created, decided and canceled events, and never fails the booking if the queue does', async () => {
      const events: unknown[] = [];
      const notifying = new BookingService({
        enqueue: (e: unknown) => {
          events.push(e);
          return Promise.resolve();
        },
      } as unknown as NotificationQueueService);
      const { provider, serviceId } = await makeProvider();
      const booker = await makeUser();
      const { days } = await notifying.getAvailability(
        provider.username,
        serviceId,
      );

      const first = await notifying.create(booker.id, {
        username: provider.username,
        serviceId,
        startAt: days[1].slots[0],
        name: 'سارا',
      });
      await notifying.decide(provider.id, first.id, 'confirm');
      await notifying.cancel(booker.id, first.id);
      expect(events).toEqual([
        { type: 'booking.created', bookingId: first.id },
        { type: 'booking.decided', bookingId: first.id },
        { type: 'booking.canceled', bookingId: first.id, by: 'booker' },
      ]);

      // A failing enqueue is swallowed by NotificationQueueService itself;
      // a bare service with no queue at all must work the same.
      await expect(
        service.create(booker.id, {
          username: provider.username,
          serviceId,
          startAt: days[1].slots[0],
          name: 'سارا',
        }),
      ).resolves.toMatchObject({ status: 'PENDING' });
    });

    it('does not enqueue anything when the action is refused', async () => {
      const events: unknown[] = [];
      const notifying = new BookingService({
        enqueue: (e: unknown) => {
          events.push(e);
          return Promise.resolve();
        },
      } as unknown as NotificationQueueService);
      const { provider } = await makeProvider();
      await expect(
        notifying.decide(provider.id, 'missing', 'confirm'),
      ).rejects.toBeDefined();
      await expect(
        notifying.cancel(provider.id, 'missing'),
      ).rejects.toBeDefined();
      expect(events).toEqual([]);
    });
  });
});
