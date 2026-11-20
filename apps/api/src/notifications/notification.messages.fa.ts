import { formatNumber } from '@vaqt/shared';

export const notificationMessagesFa = {
  baleNewBooking: (p: {
    booker: string;
    service: string;
    minutes: number;
    when: string;
    note: string | null;
    phone: string;
  }) =>
    [
      '📅 درخواست رزرو جدید',
      `${p.booker} · ${p.service} (${formatNumber(p.minutes)} دقیقه)`,
      p.when,
      p.note ? `موضوع: ${p.note}` : null,
      `شماره: ${p.phone}`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n'),
  baleCanceledByBooker: (p: {
    booker: string;
    service: string;
    when: string;
  }) => `🚫 ${p.booker} رزرو «${p.service}» را لغو کرد.\n${p.when}`,
  baleReminder: (p: { booker: string; service: string; when: string }) =>
    `⏰ یادآوری: جلسه‌ی «${p.service}» با ${p.booker} تا یک ساعت دیگر است.\n${p.when}`,
  bookerConfirmed: (p: {
    provider: string;
    service: string;
    when: string;
    link: string;
  }) =>
    `✅ ${p.provider} رزرو «${p.service}» شما را تأیید کرد.\n${p.when}\nپیگیری: ${p.link}`,
  bookerRejected: (p: { provider: string; service: string; when: string }) =>
    `❌ ${p.provider} رزرو «${p.service}» شما را نپذیرفت.\n${p.when}`,
  bookerCanceledByProvider: (p: {
    provider: string;
    service: string;
    when: string;
  }) => `🚫 ${p.provider} رزرو «${p.service}» را لغو کرد.\n${p.when}`,
  bookerReminder: (p: { provider: string; service: string; when: string }) =>
    `⏰ یادآوری: جلسه‌ی «${p.service}» با ${p.provider}\n${p.when}`,
};

/** SMS template keys; ids come from env `SMS_TEMPLATE_<KEY>` (sms.ir pattern ids). */
export type SmsTemplateKey =
  | 'BOOKING_NEW_FOR_PROVIDER'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_CANCELED_BY_PROVIDER'
  | 'BOOKING_REMINDER';
