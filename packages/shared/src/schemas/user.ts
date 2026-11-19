import { z } from 'zod';

export const updateUserProfileSchema = z.object({
  displayName: z.string().trim().min(3).max(50).optional(),
  headline: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
});
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
