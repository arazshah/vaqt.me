import { z } from 'zod';
import { isValidDateKey } from '../utils/tehran-time';

export const SERVICE_MODES = ['online', 'in_person', 'phone'] as const;
export const ServiceModeSchema = z.enum(SERVICE_MODES);
export type ServiceMode = z.infer<typeof ServiceModeSchema>;

export const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'REJECTED',
  'CANCELED',
] as const;
export const BookingStatusSchema = z.enum(BOOKING_STATUSES);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

/** Statuses that occupy a time slot. */
export const SLOT_BLOCKING_STATUSES: readonly BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
];

const minuteOfDay = z.number().int().min(0).max(1440).multipleOf(5);

export const serviceInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(2, 'نام جلسه حداقل ۲ نویسه باشد').max(60),
  durationMinutes: z.number().int().min(5).max(240).multipleOf(5),
  mode: ServiceModeSchema,
  note: z.string().trim().max(300).nullable().optional(),
});
export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const availabilityRuleInputSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: minuteOfDay,
    endMinute: minuteOfDay,
  })
  .refine((r) => r.startMinute < r.endMinute, {
    message: 'ساعت شروع باید قبل از پایان باشد',
    path: ['endMinute'],
  });
export type AvailabilityRuleInput = z.infer<typeof availabilityRuleInputSchema>;

export const dateKeySchema = z
  .string()
  .refine(isValidDateKey, 'تاریخ معتبر نیست');

export const updateBookingSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  minNoticeHours: z.number().int().min(0).max(168).optional(),
  maxDaysAhead: z.number().int().min(1).max(90).optional(),
  services: z.array(serviceInputSchema).max(8).optional(),
  rules: z
    .array(availabilityRuleInputSchema)
    .max(28)
    .refine(
      (rules) => {
        // Windows on the same weekday must not overlap.
        const byDay = new Map<number, [number, number][]>();
        for (const r of rules) {
          const list = byDay.get(r.weekday) ?? [];
          list.push([r.startMinute, r.endMinute]);
          byDay.set(r.weekday, list);
        }
        for (const list of byDay.values()) {
          list.sort((a, b) => a[0] - b[0]);
          for (let i = 1; i < list.length; i++) {
            if (list[i][0] < list[i - 1][1]) return false;
          }
        }
        return true;
      },
      { message: 'بازه‌های یک روز نباید هم‌پوشانی داشته باشند' },
    )
    .optional(),
  exceptions: z.array(dateKeySchema).max(200).optional(),
});
export type UpdateBookingSettingsInput = z.infer<
  typeof updateBookingSettingsSchema
>;

export const createBookingSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(30),
  serviceId: z.string().min(1),
  startAt: z.string().datetime(),
  name: z.string().trim().min(2, 'نام را وارد کنید').max(60),
  note: z.string().trim().max(500).nullable().optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const decideBookingSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['confirm', 'reject']),
});
export type DecideBookingInput = z.infer<typeof decideBookingSchema>;

export const bookingIdSchema = z.object({ id: z.string().min(1) });
export type BookingIdInput = z.infer<typeof bookingIdSchema>;

export const bookingTokenSchema = z.object({
  token: z.string().min(16).max(64),
});
export type BookingTokenInput = z.infer<typeof bookingTokenSchema>;

// ---- API shapes -----------------------------------------------------------

export interface ServiceView {
  id: string;
  name: string;
  durationMinutes: number;
  mode: ServiceMode;
  note: string | null;
}

export interface BookingSettingsView {
  enabled: boolean;
  minNoticeHours: number;
  maxDaysAhead: number;
  services: ServiceView[];
  rules: AvailabilityRuleInput[];
  exceptions: string[];
}

export interface PublicBookingInfo {
  enabled: boolean;
  services: ServiceView[];
}

export interface AvailabilityDay {
  /** Iran calendar date, 'YYYY-MM-DD'. */
  date: string;
  /** Free slot start instants (ISO, UTC), ascending. */
  slots: string[];
}

export interface ProviderBookingView {
  id: string;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  serviceName: string;
  durationMinutes: number;
  bookerName: string;
  // Local 09… number. Shown to the provider only: the booker gave it (and
  // verified it by SMS code) in order to be contacted about this booking.
  bookerPhone: string;
  note: string | null;
  createdAt: string;
}

export interface MyBookingView {
  id: string;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  serviceName: string;
  durationMinutes: number;
  providerName: string;
  providerUsername: string | null;
  cancelToken: string;
}

export interface BookingTokenView {
  status: BookingStatus;
  startAt: string;
  endAt: string;
  serviceName: string;
  providerName: string;
  providerUsername: string | null;
  canCancel: boolean;
}
