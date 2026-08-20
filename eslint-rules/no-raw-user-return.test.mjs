import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tsParser from '@typescript-eslint/parser';
import { RuleTester } from '@typescript-eslint/rule-tester';
import rule from './no-raw-user-return.mjs';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(dirname, '__fixtures__');

function fixture(name) {
  // filename is relative to languageOptions.parserOptions.tsconfigRootDir
  // (set to fixturesDir below) — typescript-eslint resolves it against
  // that root, not against process.cwd().
  return { filename: name, code: readFileSync(path.join(fixturesDir, name), 'utf8') };
}

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: fixturesDir,
    },
  },
});

ruleTester.run('no-raw-user-return', rule, {
  valid: [
    fixture('valid-public-user.ts'),
    // Regression test: PrivateUser has systemRole but not phone/
    // phoneVerifiedAt, so only 1 of the 3 markers is present — must not
    // be flagged as a raw-User leak.
    fixture('valid-private-user-shape.ts'),
  ],
  invalid: [
    {
      ...fixture('invalid-direct-leak.ts'),
      errors: [{ messageId: 'rawUser' }],
    },
    {
      ...fixture('invalid-wrapped-leak.ts'),
      errors: [{ messageId: 'rawUser' }],
    },
  ],
});
