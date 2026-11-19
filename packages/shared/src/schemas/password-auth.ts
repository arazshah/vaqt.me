import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email('ایمیل معتبر نیست');

export const passwordSchema = z
  .string()
  .min(8, 'رمز عبور حداقل ۸ نویسه باشد')
  .max(128, 'رمز عبور بیش از حد طولانی است')
  .refine((v) => /[A-Za-z؀-ۿ]/.test(v) && /[0-9۰-۹]/.test(v), {
    message: 'رمز عبور باید هم حرف و هم عدد داشته باشد',
  });

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: z.string().trim().min(2).max(50).optional(),
    /** Anti-spam: signed token from GET /auth/register-token. */
    formToken: z.string().min(10).max(300),
    /** Honeypot: hidden field a real user never fills. */
    website: z.string().max(200).optional(),
  })
  .refine((v) => v.password.toLowerCase() !== v.email, {
    message: 'رمز عبور نباید همان ایمیل باشد',
    path: ['password'],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Login name of the built-in administrator account. It is stored in the
 * email column but is not an email, so no sign-up can ever claim it.
 */
export const ADMIN_LOGIN = 'admin';

export const loginSchema = z.object({
  // An email, or the built-in admin's login name.
  email: z.union([
    z.string().trim().toLowerCase().pipe(z.literal(ADMIN_LOGIN)),
    emailSchema,
  ]),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'رمز جدید باید با رمز فعلی فرق داشته باشد',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface AuthMethods {
  password: boolean;
  sms: boolean;
}
