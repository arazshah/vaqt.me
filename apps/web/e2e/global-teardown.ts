import { execSync } from 'node:child_process';

// Every user this suite creates uses TEST_PHONE_PREFIX (+9899, see
// fixtures/test-data.ts), so apps/api's own cleanup:qa script (see
// CLAUDE.md's cleanup-qa docs) can safely find and remove them — the same
// tool every manual QA pass in this project's history has used, not a
// separate teardown mechanism invented for this suite.
export default function globalTeardown(): void {
  try {
    execSync(
      'pnpm --filter @vaqt/api cleanup:qa --execute --older-than-minutes=0',
      {
        cwd: `${__dirname}/../../..`,
        stdio: 'inherit',
        env: {
          ...process.env,
          DATABASE_URL:
            process.env.DATABASE_URL ??
            'postgresql://vaqt:vaqt@localhost:5432/vaqt',
          REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6380',
          REDIS_PREFIX: 'vaqt:e2e:',
        },
      },
    );
  } catch (error) {
    // Cleanup is best-effort — a failed teardown must never fail the test
    // run itself (the run's real result already happened).
    console.warn('[e2e] cleanup:qa failed, leaving test data in place:', error);
  }
}
