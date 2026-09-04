// Matches TEST_PHONE_PREFIX in apps/api/src/test-support/test-db.ts — the
// same convention apps/api's `cleanup:qa` script (CLAUDE.md's cleanup-qa
// docs) uses to find and safely delete test data. Keep this in sync by
// hand; there's no shared package boundary between apps/api and this e2e
// suite to import it from.
export const TEST_PHONE_PREFIX = '+9899';

export function randomTestPhone(): string {
  const suffix = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  return `${TEST_PHONE_PREFIX}${suffix}`;
}

// Overrides OtpService.generateCode() outside production (see
// apps/api/src/auth/otp/otp.service.ts) — sourced from the same
// DEV_FIXED_OTP env var the API server actually reads, so this file can't
// drift from what the running server will accept.
export const E2E_OTP_CODE = process.env.DEV_FIXED_OTP ?? '11223';

export function randomTitle(prefix: string): string {
  const suffix = `${String(Date.now())}-${String(Math.floor(Math.random() * 1000))}`;
  return `${prefix} ${suffix}`;
}
