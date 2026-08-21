import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      // Only the formatting functions get an enforced gate for now (see
      // CLAUDE.md "بدهی فنی" — a package-wide threshold is still open,
      // scheduled for phase 11). number.ts holds every Rial/Toman/Persian
      // digit formatter actually wired into the UI (PriceTag, RequestCard);
      // date.ts is an unimplemented placeholder (`formatJalaliDate`,
      // explicitly TODO'd for a later phase) and would need a real
      // dayjs+jalaliday implementation before a coverage gate on it means
      // anything.
      thresholds: {
        'src/utils/number.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
