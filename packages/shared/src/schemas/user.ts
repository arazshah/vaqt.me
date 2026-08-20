import { z } from 'zod';
import { RequestModeSchema } from '../constants/enums';

// Only http(s) linkedin.com / *.linkedin.com links are accepted — a real
// domain check, not just "looks like a URL".
const linkedinUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const host = new URL(value).hostname.toLowerCase();
      return host === 'linkedin.com' || host.endsWith('.linkedin.com');
    } catch {
      return false;
    }
  }, 'باید یک لینک معتبر لینکدین باشد');

export const updateUserProfileSchema = z.object({
  displayName: z.string().trim().min(3).max(50).optional(),
  headline: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  modePreference: RequestModeSchema.nullable().optional(),
  linkedinUrl: z
    .union([linkedinUrlSchema, z.literal('')])
    .nullable()
    .optional(),
  timezone: z.string().trim().min(1).max(60).optional(),
});
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

export const putUserSkillsSchema = z.object({
  skillIds: z.array(z.string().min(1)).max(20),
});
export type PutUserSkillsInput = z.infer<typeof putUserSkillsSchema>;
