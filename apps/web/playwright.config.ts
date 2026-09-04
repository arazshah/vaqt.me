import { defineConfig, devices } from '@playwright/test';

const WEB_BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const API_BASE_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';

// Every var apps/api's env-validation.ts and provider modules actually
// need (see CLAUDE.md's env-validation section) — deliberately minimal,
// not a copy of .env.example. DEV_FIXED_OTP is the load-bearing one: it
// makes every OTP request return this exact code (see
// apps/api/src/auth/otp/otp.service.ts), so this suite never has to scrape
// the mock SMS adapter's log output. Rate limits are relaxed (not
// disabled) because this suite reuses the same two test phone numbers
// across every local re-run while iterating on a test — the isolated
// `vaqt:e2e:` Redis prefix means this can't mask a real production limit
// being too strict.
const API_ENV = {
  NODE_ENV: 'development',
  PORT: '3001',
  WEB_ORIGIN: WEB_BASE_URL,
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://vaqt:vaqt@localhost:5432/vaqt',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6380',
  REDIS_PREFIX: 'vaqt:e2e:',
  OTP_PEPPER: process.env.OTP_PEPPER ?? 'e2e-otp-pepper-0123456789abcdef-local',
  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET ?? 'e2e-jwt-access-secret-0123456789abcdef',
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ?? 'e2e-jwt-refresh-secret-0123456789abcdef',
  DEV_FIXED_OTP: process.env.DEV_FIXED_OTP ?? '11223',
  SMS_PROVIDER: 'mock',
  RATE_LIMIT_PHONE_HOURLY: '1000',
  RATE_LIMIT_PHONE_DAILY: '1000',
  RATE_LIMIT_IP_HOURLY: '1000',
  RATE_LIMIT_IP_DAILY: '1000',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // one shared seeker/provider pair per run, not per-test isolated
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  globalTeardown: './e2e/global-teardown.ts',

  use: {
    baseURL: WEB_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      command: 'pnpm --filter @vaqt/api dev',
      url: `${API_BASE_URL}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: API_ENV,
    },
    {
      command: 'pnpm --filter @vaqt/web dev',
      url: WEB_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { NEXT_PUBLIC_API_URL: API_BASE_URL },
    },
  ],
});
