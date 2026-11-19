import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@vaqt/db';
import { SmsQueueService } from '../auth/sms/sms-queue.service';
import { RedisService } from '../common/redis/redis.service';
import { BaleLinkService } from '../messenger/bale-link.service';
import { SettingsService } from '../settings/settings.service';
import { baleMessagesFa } from '../messenger/messenger.messages.fa';
import {
  MESSENGER_PORT,
  type MessengerPort,
} from '../messenger/messenger.port';
import { formatWhen, toLocalPhone } from './format';
import {
  notificationMessagesFa as texts,
  type SmsTemplateKey,
} from './notification.messages.fa';
import type { NotificationEvent } from './notification.types';

const SMS_TEMPLATE_SETTING: Record<SmsTemplateKey, string> = {
  BOOKING_NEW_FOR_PROVIDER: 'sms.template.bookingNewForProvider',
  BOOKING_CONFIRMED: 'sms.template.bookingConfirmed',
  BOOKING_REJECTED: 'sms.template.bookingRejected',
  BOOKING_CANCELED_BY_PROVIDER: 'sms.template.bookingCanceledByProvider',
  BOOKING_REMINDER: 'sms.template.bookingReminder',
};

const PROVIDER_SMS_DAILY_CAP = 10;
const HOUR_MS = 3_600_000;

type BookingWithPeople = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;

function loadBooking(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    include: {
      provider: { select: { id: true, phone: true, displayName: true } },
      booker: { select: { id: true, phone: true, displayName: true } },
    },
  });
}

@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    @Inject(MESSENGER_PORT) private readonly messenger: MessengerPort,
    private readonly links: BaleLinkService,
    private readonly sms: SmsQueueService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async handle(event: NotificationEvent): Promise<void> {
    if (event.type === 'reminder.scan') {
      await this.scanReminders();
      return;
    }
    const booking = await loadBooking(event.bookingId);
    if (!booking) return; // deleted since it was queued

    switch (event.type) {
      case 'booking.created':
        await this.onCreated(booking);
        break;
      case 'booking.decided':
        await this.onDecided(booking);
        break;
      case 'booking.canceled':
        await this.onCanceled(booking, event.by);
        break;
    }
  }

  // ---- events -----------------------------------------------------------

  private async onCreated(b: BookingWithPeople): Promise<void> {
    if (b.status !== 'PENDING') return; // already decided/canceled by now
    const text = texts.baleNewBooking({
      booker: b.bookerName,
      service: b.serviceName,
      minutes: b.durationMinutes,
      when: formatWhen(b.startAt),
      note: b.note,
      phone: toLocalPhone(b.booker.phone),
    });
    await this.notifyProvider(
      b,
      text,
      [
        [
          { text: baleMessagesFa.confirmButton, callbackData: `bk:c:${b.id}` },
          { text: baleMessagesFa.rejectButton, callbackData: `bk:r:${b.id}` },
        ],
      ],
      'BOOKING_NEW_FOR_PROVIDER',
    );
  }

  private async onDecided(b: BookingWithPeople): Promise<void> {
    const key: SmsTemplateKey | null =
      b.status === 'CONFIRMED'
        ? 'BOOKING_CONFIRMED'
        : b.status === 'REJECTED'
          ? 'BOOKING_REJECTED'
          : null;
    if (!key) return;
    await this.smsBooker(b, key);
  }

  private async onCanceled(
    b: BookingWithPeople,
    by: 'booker' | 'provider',
  ): Promise<void> {
    if (by === 'provider') {
      await this.smsBooker(b, 'BOOKING_CANCELED_BY_PROVIDER');
      return;
    }
    await this.notifyProvider(
      b,
      texts.baleCanceledByBooker({
        booker: b.bookerName,
        service: b.serviceName,
        when: formatWhen(b.startAt),
      }),
      undefined,
      'BOOKING_NEW_FOR_PROVIDER',
    );
  }

  // ---- reminders ---------------------------------------------------------

  /**
   * Claims each reminder with a conditional update (flag still null), so two
   * overlapping scans — or a retry — can never send the same reminder twice.
   * A booking confirmed after its reminder window already opened is not
   * reminded for that window (it was just told it's confirmed).
   */
  async scanReminders(now = new Date()): Promise<{ r24: number; r1: number }> {
    let r24 = 0;
    let r1 = 0;

    const due24 = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        reminder24SentAt: null,
        startAt: { gt: now, lte: new Date(now.getTime() + 24 * HOUR_MS) },
      },
      select: { id: true, startAt: true, decidedAt: true },
    });
    for (const c of due24) {
      if (
        !c.decidedAt ||
        c.decidedAt.getTime() > c.startAt.getTime() - 24 * HOUR_MS
      ) {
        // Booked too late for a 24h reminder; mark so we never reconsider it.
        await prisma.booking.updateMany({
          where: { id: c.id, reminder24SentAt: null },
          data: { reminder24SentAt: now },
        });
        continue;
      }
      const claimed = await prisma.booking.updateMany({
        where: { id: c.id, reminder24SentAt: null, status: 'CONFIRMED' },
        data: { reminder24SentAt: now },
      });
      if (claimed.count === 1) {
        const b = await loadBooking(c.id);
        if (b) await this.smsBooker(b, 'BOOKING_REMINDER');
        r24++;
      }
    }

    const due1 = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        reminder1SentAt: null,
        startAt: { gt: now, lte: new Date(now.getTime() + HOUR_MS) },
      },
      select: { id: true, startAt: true, decidedAt: true },
    });
    for (const c of due1) {
      const tooLate =
        !c.decidedAt || c.decidedAt.getTime() > c.startAt.getTime() - HOUR_MS;
      const claimed = await prisma.booking.updateMany({
        where: { id: c.id, reminder1SentAt: null, status: 'CONFIRMED' },
        data: { reminder1SentAt: now },
      });
      if (claimed.count === 1 && !tooLate) {
        const b = await loadBooking(c.id);
        if (b) {
          await this.smsBooker(b, 'BOOKING_REMINDER');
          await this.notifyProvider(
            b,
            texts.baleReminder({
              booker: b.bookerName,
              service: b.serviceName,
              when: formatWhen(b.startAt),
            }),
            undefined,
            null,
          );
        }
        r1++;
      }
    }
    return { r24, r1 };
  }

  // ---- delivery helpers --------------------------------------------------

  /**
   * Bale if the provider linked it (errors propagate so BullMQ retries),
   * otherwise an SMS — capped per provider per day so a flood of bookings
   * can't turn into an SMS bill. `smsKey: null` means "Bale only".
   */
  private async notifyProvider(
    b: BookingWithPeople,
    text: string,
    keyboard: Parameters<MessengerPort['sendMessage']>[2],
    smsKey: SmsTemplateKey | null,
  ): Promise<void> {
    const chatId = await this.links.getChatId(b.providerId);
    if (chatId) {
      await this.messenger.sendMessage(chatId, text, keyboard);
      return;
    }
    if (!smsKey) return;
    const day = new Date().toISOString().slice(0, 10);
    const capKey = this.redis.key('notif-sms', b.providerId, day);
    const used = await this.redis.client.incr(capKey);
    if (used === 1) await this.redis.client.expire(capKey, 86_400);
    if (used > PROVIDER_SMS_DAILY_CAP) {
      this.logger.warn(`provider sms cap reached for ${b.providerId}`);
      return;
    }
    await this.sendSms(b.provider.phone, smsKey, {
      NAME: b.bookerName,
      TIME: formatWhen(b.startAt),
    });
  }

  private async smsBooker(
    b: BookingWithPeople,
    key: SmsTemplateKey,
  ): Promise<void> {
    await this.sendSms(b.booker.phone, key, {
      NAME: b.provider.displayName,
      SERVICE: b.serviceName,
      TIME: formatWhen(b.startAt),
      LINK: `${this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000'}/b/${b.cancelToken}`,
    });
  }

  private async sendSms(
    phone: string,
    key: SmsTemplateKey,
    params: Record<string, string>,
  ): Promise<void> {
    const templateId =
      (await this.settings.get(SMS_TEMPLATE_SETTING[key])) ??
      (process.env.NODE_ENV === 'production' ? null : key.toLowerCase());
    if (!templateId) {
      this.logger.warn(
        `sms template for ${key} is not set in the admin panel; skipping sms`,
      );
      return;
    }
    await this.sms.enqueueNotification({ phone, templateId, params });
  }
}
