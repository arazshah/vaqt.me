import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  // Declarations are emitted by plain `tsc` (see the `build` script), not
  // tsup's bundled `dts` option. tsup's dts step uses rollup-plugin-dts,
  // which cannot parse the `import $Types = runtime.Types` TS
  // import-equals syntax inside Prisma's generated runtime .d.ts, and
  // separately emits an absolute, machine-specific path for one generic
  // default (`DefaultArgs`) when the generated client is external —
  // reproduced live 2026-08-21, would silently break any other machine's
  // typecheck (CI included) since the path only resolves on the machine
  // that built it. Plain `tsc --declaration --emitDeclarationOnly`
  // handles the exact same re-export with fully relative paths and no
  // crash — verified with a real `dist/index.d.ts` diff.
  dts: false,
  sourcemap: true,
  clean: true,
  // The generated Prisma client (packages/db/generated/prisma) is a local
  // relative import now, not a bare package specifier, so tsup's default
  // "externalize node_modules dependencies" heuristic no longer applies to
  // it and it would otherwise get fully inlined — bloating dist/index.js
  // by ~370KB with Prisma's runtime/WASM loader. Keep it external and
  // unbundled, exactly like the old default `@prisma/client` output was
  // treated automatically.
  external: [/\/generated\/prisma\//],
});
