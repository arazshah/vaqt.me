import { randomBytes } from 'crypto';
import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { Prisma, prisma } from '@vaqt/db';
import {
  BookingStatusSchema,
  ServiceModeSchema,
  SLOT_BLOCKING_STATUSES,
  tehranDateKey,
  type AvailabilityDay,
  type BookingSettingsView,
  type BookingStatus,
  type BookingTokenView,
  type CreateBookingInput,
  type MyBookingView,
  type ProviderBookingView,
  type ServiceView,
  type UpdateBookingSettingsInput,
} from '@vaqt/shared';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { NotificationQueueService } from '../notifications/notification-queue.service';
import { generateSlots } from './slots';

const MAX_PENDING_PER_PROVIDER = 2;
const MAX_PENDING_TOTAL = 5;
const PER_HOUR_MS = 3_600_000;

type DbTx = Prisma.TransactionClient;

function toLocalPhone(canonical: string | null): string {
  if (!canonical) return '';
  return canonical.startsWith('+98') ? `0${canonical.slice(3)}` : canonical;
}

function toStatus(raw: string): BookingStatus {
  const parsed = BookingStatusSchema.safeParse(raw);
  return parsed.success ? parsed.data : 'CANCELED';
}

function toServiceView(s: {
  id: string;
  name: string;
  durationMinutes: number;
  mode: string;
  note: string | null;
}): ServiceView {
  const mode = ServiceModeSchema.safeParse(s.mode);
  return {
    id: s.id,
    name: s.name,
    durationMinutes: s.durationMinutes,
    mode: mode.success ? mode.data : 'online',
    note: s.note,
  };
}

const notFound = () => new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);

@Injectable()
export class BookingService {
  // Optional so unit tests can build the service without a queue.
  constructor(
    @Optional() private readonly notifications?: NotificationQueueService,
  ) {}

  // ------------------------------------------------------------------
  // Provider settings
  // ------------------------------------------------------------------

  async getSettings(userId: string): Promise<BookingSettingsView> {
    const [card, services, rules, exceptions] = await Promise.all([
      prisma.card.findUnique({ where: { userId } }),
      prisma.serviceType.findMany({
        where: { userId, isActive: true },
        orderBy: { order: 'asc' },
      }),
      prisma.availabilityRule.findMany({
        where: { userId },
        orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      }),
      prisma.availabilityException.findMany({
        where: { userId },
        orderBy: { date: 'asc' },
      }),
    ]);
    return {
      enabled: card?.bookingEnabled ?? false,
      minNoticeHours: card?.minNoticeHours ?? 2,
      maxDaysAhead: card?.maxDaysAhead ?? 30,
      services: services.map(toServiceView),
      rules: rules.map((r) => ({
        weekday: r.weekday,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
      })),
      exceptions: exceptions.map((e) => e.date),
    };
  }

  async updateSettings(
    userId: string,
    input: UpdateBookingSettingsInput,
  ): Promise<BookingSettingsView> {
    await prisma.$transaction(async (tx) => {
      const cardData = {
        ...(input.enabled !== undefined && { bookingEnabled: input.enabled }),
        ...(input.minNoticeHours !== undefined && {
          minNoticeHours: input.minNoticeHours,
        }),
        ...(input.maxDaysAhead !== undefined && {
          maxDaysAhead: input.maxDaysAhead,
        }),
      };
      await tx.card.upsert({
        where: { userId },
        create: { userId, ...cardData },
        update: cardData,
      });

      if (input.services) {
        const keepIds: string[] = [];
        for (const [order, svc] of input.services.entries()) {
          const data = {
            name: svc.name,
            durationMinutes: svc.durationMinutes,
            mode: svc.mode,
            note: svc.note ?? null,
            isActive: true,
            order,
          };
          if (svc.id) {
            // Only touch a service this user owns.
            const res = await tx.serviceType.updateMany({
              where: { id: svc.id, userId },
              data,
            });
            if (res.count === 0) throw notFound();
            keepIds.push(svc.id);
          } else {
            const created = await tx.serviceType.create({
              data: { ...data, userId },
            });
            keepIds.push(created.id);
          }
        }
        // Dropped services are deactivated, never deleted: past bookings
        // still point at them.
        await tx.serviceType.updateMany({
          where: { userId, id: { notIn: keepIds } },
          data: { isActive: false },
        });
      }

      if (input.rules) {
        await tx.availabilityRule.deleteMany({ where: { userId } });
        await tx.availabilityRule.createMany({
          data: input.rules.map((r) => ({ ...r, userId })),
        });
      }

      if (input.exceptions) {
        await tx.availabilityException.deleteMany({ where: { userId } });
        await tx.availabilityException.createMany({
          data: [...new Set(input.exceptions)].map((date) => ({
            userId,
            date,
          })),
        });
      }
    });
    return this.getSettings(userId);
  }

  // ------------------------------------------------------------------
  // Public availability
  // ------------------------------------------------------------------

  async getAvailability(
    username: string,
    serviceId: string,
  ): Promise<{ days: AvailabilityDay[] }> {
    const provider = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true, status: true },
    });
    if (!provider || provider.status !== 'ACTIVE') throw notFound();
    const days = await this.computeDays(prisma, provider.id, serviceId);
    return { days };
  }

  private async computeDays(
    db: DbTx | typeof prisma,
    providerId: string,
    serviceId: string,
    now = new Date(),
  ): Promise<AvailabilityDay[]> {
    const [card, service] = await Promise.all([
      db.card.findUnique({ where: { userId: providerId } }),
      db.serviceType.findFirst({
        where: { id: serviceId, userId: providerId, isActive: true },
      }),
    ]);
    if (!service) throw notFound();
    if (!card?.bookingEnabled) {
      throw new AppError(ErrorCode.BOOKING_DISABLED, HttpStatus.CONFLICT);
    }
    const [rules, exceptions, busy] = await Promise.all([
      db.availabilityRule.findMany({ where: { userId: providerId } }),
      db.availabilityException.findMany({ where: { userId: providerId } }),
      db.booking.findMany({
        where: {
          providerId,
          status: { in: [...SLOT_BLOCKING_STATUSES] },
          endAt: { gt: now },
        },
        select: { startAt: true, endAt: true },
      }),
    ]);
    return generateSlots({
      rules: rules.map((r) => ({
        weekday: r.weekday,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
      })),
      exceptions: new Set(exceptions.map((e) => e.date)),
      durationMinutes: service.durationMinutes,
      minNoticeHours: card.minNoticeHours,
      maxDaysAhead: card.maxDaysAhead,
      now,
      busy,
    });
  }

  // ------------------------------------------------------------------
  // Creating a booking
  // ------------------------------------------------------------------

  /** Lock-free early check (used for drafts); create() re-checks under lock. */
  async assertSlotFree(input: CreateBookingInput): Promise<void> {
    const provider = await prisma.user.findUnique({
      where: { username: input.username.toLowerCase() },
      select: { id: true, status: true },
    });
    if (!provider || provider.status !== 'ACTIVE') throw notFound();
    const startAt = new Date(input.startAt);
    const days = await this.computeDays(prisma, provider.id, input.serviceId);
    const free = days.some(
      (d) =>
        d.date === tehranDateKey(startAt) &&
        d.slots.includes(startAt.toISOString()),
    );
    if (!free) {
      throw new AppError(ErrorCode.SLOT_UNAVAILABLE, HttpStatus.CONFLICT);
    }
  }

  async create(
    bookerId: string,
    input: CreateBookingInput,
  ): Promise<MyBookingView> {
    const provider = await prisma.user.findUnique({
      where: { username: input.username.toLowerCase() },
      select: { id: true, status: true, username: true, displayName: true },
    });
    if (!provider || provider.status !== 'ACTIVE') throw notFound();
    if (provider.id === bookerId) {
      throw new AppError(
        ErrorCode.OWN_CARD_BOOKING_FORBIDDEN,
        HttpStatus.FORBIDDEN,
      );
    }
    const startAt = new Date(input.startAt);

    const booking = await prisma.$transaction(async (tx) => {
      // Serialise every booking attempt for this provider. Without this lock,
      // two requests for the same slot can both pass the availability check
      // before either has inserted its row. (A Postgres exclusion constraint
      // would need btree_gist, which managed databases often forbid.)
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${provider.id} FOR UPDATE`;

      const now = new Date();
      const days = await this.computeDays(
        tx,
        provider.id,
        input.serviceId,
        now,
      );
      const isoStart = startAt.toISOString();
      const free = days.some(
        (d) => d.date === tehranDateKey(startAt) && d.slots.includes(isoStart),
      );
      if (!free) {
        throw new AppError(ErrorCode.SLOT_UNAVAILABLE, HttpStatus.CONFLICT);
      }

      const [pendingWithProvider, pendingTotal] = await Promise.all([
        tx.booking.count({
          where: { bookerId, providerId: provider.id, status: 'PENDING' },
        }),
        tx.booking.count({ where: { bookerId, status: 'PENDING' } }),
      ]);
      if (
        pendingWithProvider >= MAX_PENDING_PER_PROVIDER ||
        pendingTotal >= MAX_PENDING_TOTAL
      ) {
        throw new AppError(
          ErrorCode.BOOKING_LIMIT_REACHED,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const service = await tx.serviceType.findUniqueOrThrow({
        where: { id: input.serviceId },
      });
      return tx.booking.create({
        data: {
          providerId: provider.id,
          bookerId,
          serviceId: service.id,
          serviceName: service.name,
          durationMinutes: service.durationMinutes,
          startAt,
          endAt: new Date(startAt.getTime() + service.durationMinutes * 60_000),
          bookerName: input.name,
          note: input.note || null,
          cancelToken: randomBytes(24).toString('base64url'),
        },
      });
    });

    await this.notifications?.enqueue({
      type: 'booking.created',
      bookingId: booking.id,
    });

    return {
      id: booking.id,
      status: toStatus(booking.status),
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      serviceName: booking.serviceName,
      durationMinutes: booking.durationMinutes,
      providerName: provider.displayName,
      providerUsername: provider.username,
      cancelToken: booking.cancelToken,
    };
  }

  // ------------------------------------------------------------------
  // Lists
  // ------------------------------------------------------------------

  async listForProvider(userId: string): Promise<ProviderBookingView[]> {
    const rows = await prisma.booking.findMany({
      where: {
        providerId: userId,
        // Recent past stays visible for a day so "who was that" is answerable.
        endAt: { gt: new Date(Date.now() - 24 * PER_HOUR_MS) },
      },
      orderBy: { startAt: 'asc' },
      take: 200,
      include: { booker: { select: { phone: true, email: true } } },
    });
    return rows.map((b) => ({
      id: b.id,
      status: toStatus(b.status),
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      serviceName: b.serviceName,
      durationMinutes: b.durationMinutes,
      bookerName: b.bookerName,
      bookerPhone: toLocalPhone(b.booker.phone),
      bookerEmail: b.booker.email,
      note: b.note,
      createdAt: b.createdAt.toISOString(),
    }));
  }

  async listMine(userId: string): Promise<MyBookingView[]> {
    const rows = await prisma.booking.findMany({
      where: { bookerId: userId },
      orderBy: { startAt: 'desc' },
      take: 100,
      include: { provider: { select: { displayName: true, username: true } } },
    });
    return rows.map((b) => ({
      id: b.id,
      status: toStatus(b.status),
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      serviceName: b.serviceName,
      durationMinutes: b.durationMinutes,
      providerName: b.provider.displayName,
      providerUsername: b.provider.username,
      cancelToken: b.cancelToken,
    }));
  }

  // ------------------------------------------------------------------
  // Decisions and cancellation
  // ------------------------------------------------------------------

  async decide(
    providerId: string,
    id: string,
    action: 'confirm' | 'reject',
  ): Promise<ProviderBookingView[]> {
    // Conditional update: only a still-pending, still-future booking of this
    // provider changes, so two quick taps (or a cancel racing the decision)
    // can't produce an impossible transition.
    const res = await prisma.booking.updateMany({
      where: {
        id,
        providerId,
        status: 'PENDING',
        startAt: { gt: new Date() },
      },
      data: {
        status: action === 'confirm' ? 'CONFIRMED' : 'REJECTED',
        decidedAt: new Date(),
      },
    });
    if (res.count === 0) {
      const exists = await prisma.booking.findFirst({
        where: { id, providerId },
        select: { id: true },
      });
      if (!exists) throw notFound();
      throw new AppError(ErrorCode.BOOKING_NOT_PENDING, HttpStatus.CONFLICT);
    }
    await this.notifications?.enqueue({
      type: 'booking.decided',
      bookingId: id,
    });
    return this.listForProvider(providerId);
  }

  private async cancelWhere(
    where: Prisma.BookingWhereInput,
    by: 'booker' | 'provider',
  ): Promise<void> {
    const target = await prisma.booking.findFirst({
      where,
      select: { id: true },
    });
    if (!target) throw notFound();
    const res = await prisma.booking.updateMany({
      where: {
        id: target.id,
        status: { in: [...SLOT_BLOCKING_STATUSES] },
        startAt: { gt: new Date() },
      },
      data: { status: 'CANCELED', cancelledBy: by, decidedAt: new Date() },
    });
    if (res.count === 0) {
      throw new AppError(
        ErrorCode.BOOKING_NOT_CANCELLABLE,
        HttpStatus.CONFLICT,
      );
    }
    await this.notifications?.enqueue({
      type: 'booking.canceled',
      bookingId: target.id,
      by,
    });
  }

  /** Either side of a booking can cancel it while it is still upcoming. */
  async cancel(userId: string, id: string): Promise<void> {
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { providerId: true, bookerId: true },
    });
    if (!booking) throw notFound();
    if (booking.bookerId === userId) {
      return this.cancelWhere({ id }, 'booker');
    }
    if (booking.providerId === userId) {
      return this.cancelWhere({ id }, 'provider');
    }
    // Same answer as "doesn't exist": don't reveal other people's bookings.
    throw notFound();
  }

  // ------------------------------------------------------------------
  // No-login page for the booker (/b/<token>)
  // ------------------------------------------------------------------

  async getByToken(token: string): Promise<BookingTokenView> {
    const b = await prisma.booking.findUnique({
      where: { cancelToken: token },
      include: { provider: { select: { displayName: true, username: true } } },
    });
    if (!b) throw notFound();
    const status = toStatus(b.status);
    return {
      status,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      serviceName: b.serviceName,
      providerName: b.provider.displayName,
      providerUsername: b.provider.username,
      canCancel:
        (status === 'PENDING' || status === 'CONFIRMED') &&
        b.startAt.getTime() > Date.now(),
    };
  }

  async cancelByToken(token: string): Promise<BookingTokenView> {
    await this.cancelWhere({ cancelToken: token }, 'booker');
    return this.getByToken(token);
  }
}
