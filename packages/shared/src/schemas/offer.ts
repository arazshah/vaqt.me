import { z } from 'zod';
import { moneyRialSchema } from './money';

export const submitOfferSchema = z.object({
  requestId: z.string().min(1, 'شناسه‌ی درخواست الزامی است'),
  proposedStartAt: z.coerce
    .date()
    .refine(
      (d) => d.getTime() > Date.now(),
      'زمان پیشنهادی باید در آینده باشد',
    ),
  proposedDurationMinutes: z.number().int().min(15).max(1440),
  amountRial: moneyRialSchema,
  message: z.string().trim().max(2000).nullable().optional(),
});
export type SubmitOfferInput = z.infer<typeof submitOfferSchema>;

export const selectOfferSchema = z.object({
  offerId: z.string().min(1, 'شناسه‌ی پیشنهاد الزامی است'),
});
export type SelectOfferInput = z.infer<typeof selectOfferSchema>;

export const withdrawOfferSchema = z.object({
  offerId: z.string().min(1, 'شناسه‌ی پیشنهاد الزامی است'),
});
export type WithdrawOfferInput = z.infer<typeof withdrawOfferSchema>;

export const listOffersForRequestSchema = z.object({
  requestId: z.string().min(1, 'شناسه‌ی درخواست الزامی است'),
});
export type ListOffersForRequestInput = z.infer<
  typeof listOffersForRequestSchema
>;
