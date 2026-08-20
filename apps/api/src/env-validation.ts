import { z } from 'zod';

// Values still sitting in apps/api/.env.example — a production deployment
// that copied the example file without changing these must be refused, not
// just warned about. Keep these in sync with .env.example by hand: this
// file has no I/O of its own on purpose (it runs before Nest, before
// ConfigModule, before anything else — it must not depend on the
// filesystem layout it's meant to be guarding).
const PLACEHOLDER_SECRETS = new Set([
  'change-me-in-production',
  'your-access-secret-change-in-production',
  'your-refresh-secret-change-in-production',
]);

const MIN_SECRET_LENGTH = 32;

const secretSchema = z
  .string()
  .min(
    MIN_SECRET_LENGTH,
    `باید حداقل ${String(MIN_SECRET_LENGTH)} کاراکتر باشد`,
  );

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  OTP_PEPPER: secretSchema,
  JWT_ACCESS_SECRET: secretSchema,
  JWT_REFRESH_SECRET: secretSchema,
  DATABASE_URL: z.string().min(1, 'باید تنظیم شود'),
  REDIS_URL: z.string().min(1, 'باید تنظیم شود'),
});

export interface EnvValidationFailure {
  path: string;
  message: string;
}

/**
 * Validates process.env before anything else in bootstrap runs. Returns the
 * list of failures (empty = valid) rather than throwing, so the caller can
 * decide how to report and exit — kept side-effect-free for testability.
 */
export function collectEnvValidationFailures(
  env: NodeJS.ProcessEnv,
): EnvValidationFailure[] {
  const result = envSchema.safeParse(env);
  const failures: EnvValidationFailure[] = [];

  if (!result.success) {
    for (const issue of result.error.issues) {
      failures.push({ path: issue.path.join('.'), message: issue.message });
    }
  }

  if (result.success && env.NODE_ENV === 'production') {
    const secrets: [string, string][] = [
      ['OTP_PEPPER', result.data.OTP_PEPPER],
      ['JWT_ACCESS_SECRET', result.data.JWT_ACCESS_SECRET],
      ['JWT_REFRESH_SECRET', result.data.JWT_REFRESH_SECRET],
    ];
    for (const [name, value] of secrets) {
      if (PLACEHOLDER_SECRETS.has(value)) {
        failures.push({
          path: name,
          message:
            'در production نباید مقدار placeholder فایل .env.example باشد',
        });
      }
    }
  }

  return failures;
}

/**
 * Validates process.env and exits the process immediately with a clear,
 * complete report if anything is wrong. Must run before any other bootstrap
 * step — a misconfigured secret must never reach a listening server.
 */
export function validateEnvOrExit(env: NodeJS.ProcessEnv = process.env): void {
  const failures = collectEnvValidationFailures(env);
  if (failures.length === 0) {
    return;
  }

  console.error('پیکربندی محیط نامعتبر است — برنامه بالا نمی‌آید:');
  for (const failure of failures) {
    console.error(`  - ${failure.path}: ${failure.message}`);
  }
  process.exit(1);
}
