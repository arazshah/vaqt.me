import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  // In one-shot `build`, clean first so stale output can never linger. In
  // `--watch` (dev) mode, never clean: tsup's watch rebuild deletes the
  // whole dist/ before regenerating it, which briefly removes
  // dist/index.d.ts — a real, reproduced race with any concurrently
  // running downstream `tsc`/`ts-node` process (e.g. @vaqt/db's build,
  // or apps/api's ts-node) that resolves this package's types at that
  // exact moment. Without cleaning, watch rebuilds only overwrite files
  // in place, so dist/ is never transiently incomplete.
  clean: !options.watch,
}));
