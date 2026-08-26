import { z } from 'zod';

export const submitReviewSchema = z.object({
  conversationId: z.string().min(1, 'شناسه‌ی گفتگو الزامی است'),
  rating: z
    .number()
    .int('امتیاز باید عدد صحیح باشد')
    .min(1, 'امتیاز باید بین ۱ تا ۵ باشد')
    .max(5, 'امتیاز باید بین ۱ تا ۵ باشد'),
  comment: z
    .string()
    .trim()
    .max(1000, 'نظر حداکثر ۱۰۰۰ نویسه می‌تواند باشد')
    .optional(),
});
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

export const reviewStatusSchema = z.object({
  conversationId: z.string().min(1, 'شناسه‌ی گفتگو الزامی است'),
});
export type ReviewStatusInput = z.infer<typeof reviewStatusSchema>;

export const listReviewsForUserSchema = z.object({
  userId: z.string().min(1, 'شناسه‌ی کاربر الزامی است'),
  cursor: z.string().min(1).nullable().optional(),
  limit: z.number().int().min(1).max(50).optional().default(20),
});
export type ListReviewsForUserInput = z.infer<typeof listReviewsForUserSchema>;
