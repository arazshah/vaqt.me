import { z } from 'zod';
import { RequestModeSchema } from '../constants/enums';
import { moneyRialSchema } from './money';

const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Matches the shape already written by packages/db/src/seed.ts
// (preferredWindowsA/B) — kept in sync by convention, not by a shared type,
// since Prisma's `Json` column has no schema of its own to import from.
const preferredWindowSchema = z.object({
  day: z.string().trim().min(1).max(20),
  start: z.string().regex(TIME_HHMM, 'باید به شکل HH:mm باشد'),
  end: z.string().regex(TIME_HHMM, 'باید به شکل HH:mm باشد'),
});

export const createRequestSchema = z
  .object({
    title: z.string().trim().min(5).max(120),
    description: z.string().trim().min(20).max(3000),
    categoryId: z.string().min(1),
    mode: RequestModeSchema,
    city: z.string().trim().max(80).nullable().optional(),
    durationMinutes: z.number().int().min(15).max(1440),
    budgetMinRial: moneyRialSchema,
    budgetMaxRial: moneyRialSchema,
    deadlineAt: z.coerce
      .date()
      .refine((d) => d.getTime() > Date.now(), 'مهلت باید در آینده باشد'),
    preferredWindows: z
      .array(preferredWindowSchema)
      .max(20)
      .optional()
      .default([]),
  })
  .refine((v) => v.budgetMaxRial >= v.budgetMinRial, {
    message: 'حداکثر بودجه باید بزرگ‌تر یا مساوی حداقل بودجه باشد',
    path: ['budgetMaxRial'],
  });
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const publishRequestSchema = z.object({
  id: z.string().min(1, 'شناسه‌ی درخواست الزامی است'),
});
export type PublishRequestInput = z.infer<typeof publishRequestSchema>;

export const listRequestsSchema = z.object({
  cursor: z.string().min(1).nullable().optional(),
  limit: z.number().int().min(1).max(50).optional().default(20),
});
export type ListRequestsInput = z.infer<typeof listRequestsSchema>;
