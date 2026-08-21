import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import noRawUserReturn from './eslint-rules/no-raw-user-return.mjs';
import restrictToPrivateUser from './eslint-rules/restrict-to-private-user.mjs';
import noPhysicalTailwindClasses from './eslint-rules/no-physical-tailwind-classes.mjs';

const localPlugin = {
  rules: {
    'no-raw-user-return': noRawUserReturn,
    'restrict-to-private-user': restrictToPrivateUser,
    'no-physical-tailwind-classes': noPhysicalTailwindClasses,
  },
};

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowWithDecorator: true },
      ],
      // @vaqt/db is the only place allowed to talk to the database driver —
      // every other workspace must go through its re-exports instead.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message:
                'Import from "@vaqt/db" instead — @prisma/client may only be imported inside packages/db.',
            },
          ],
        },
      ],
    },
  },
  {
    // packages/db is the one workspace allowed to import @prisma/client
    // directly, since it owns the re-export boundary in src/index.ts.
    files: ['packages/db/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // Route handlers must always exit through toPublicUser() — never the
    // raw Prisma User entity (see apps/api/src/auth/user-view.ts). This is
    // the "ESLint rule or test" enforcement decided in the Phase 3 notes
    // in CLAUDE.md; type-aware, so it catches the shape even through
    // helper functions, not just a literal `return user`.
    files: ['apps/api/src/**/*.controller.ts'],
    ignores: ['**/*.spec.ts'],
    plugins: { local: localPlugin },
    rules: {
      'local/no-raw-user-return': 'error',
    },
  },
  {
    // toPrivateUser() is a self-view-only projection (see
    // apps/api/src/auth/user-view.ts) — restrict its call sites to the two
    // services that own the self-view endpoints. Not type-aware, so it can
    // run over every apps/api source file cheaply; the rule itself no-ops
    // when the current file is one of the two allowed call sites.
    files: ['apps/api/src/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    plugins: { local: localPlugin },
    rules: {
      'local/restrict-to-private-user': 'error',
    },
  },
  {
    // Bend #1 in CLAUDE.md: logical Tailwind utilities only. Excludes
    // components/ui/** — those files are vendored in verbatim by
    // `shadcn add` (packages/ui/components.json), not hand-authored, and
    // are already verified to use logical utilities upstream.
    files: ['packages/ui/src/**/*.tsx'],
    ignores: ['packages/ui/src/components/ui/**'],
    plugins: { local: localPlugin },
    rules: {
      'local/no-physical-tailwind-classes': 'error',
    },
  },
  {
    // Test files routinely reference a class method (a jest.fn() mock, or
    // a dummy method used only as a Reflector metadata target) without
    // calling it — the exact pattern unbound-method exists to catch
    // elsewhere, but here it's never invoked in a detached `this` context,
    // so the rule has no real signal in spec files and is pure noise.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.turbo/**',
      'eslint.config.mjs',
      'commitlint.config.js',
      // Build-tool config files, not part of any package's tsconfig
      // `include` (which only covers `src/**/*`) — type-aware linting has
      // no project to resolve them against.
      '**/tsup.config.ts',
    ],
  },
);
