import { z } from 'zod';

export const createSkillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'فقط حروف کوچک انگلیسی، عدد و خط تیره مجاز است'),
  categoryId: z.string().min(1).nullable().optional(),
});
export type CreateSkillInput = z.infer<typeof createSkillSchema>;

export const updateSkillSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  categoryId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
