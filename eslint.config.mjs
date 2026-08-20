import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

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
    ],
  },
);
