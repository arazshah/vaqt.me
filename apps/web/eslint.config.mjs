import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import noPhysicalTailwindClasses from '../../eslint-rules/no-physical-tailwind-classes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const localPlugin = {
  rules: {
    'no-physical-tailwind-classes': noPhysicalTailwindClasses,
  },
};

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@vaqt/db', '@vaqt/db/*'],
              message:
                'apps/web must never talk to the database directly — go through the API instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // Bend #1 in CLAUDE.md: logical Tailwind utilities only. Scoped to
    // hand-authored app code — components vendored in via `shadcn add`
    // live in packages/ui and are covered separately there.
    files: ['src/**/*.tsx'],
    plugins: { local: localPlugin },
    rules: {
      'local/no-physical-tailwind-classes': 'error',
    },
  },
];

export default eslintConfig;
