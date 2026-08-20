import { RuleTester } from '@typescript-eslint/rule-tester';
import rule from './restrict-to-private-user.mjs';

const ruleTester = new RuleTester();

ruleTester.run('restrict-to-private-user', rule, {
  valid: [
    {
      filename: 'apps/api/src/users/users.service.ts',
      code: 'toPrivateUser(user, completeness);',
    },
    {
      filename: 'apps/api/src/auth/auth.service.ts',
      code: 'toPrivateUser(user, completeness);',
    },
    {
      filename: 'apps/api/src/users/users.controller.ts',
      code: 'toPublicUser(user);',
    },
  ],
  invalid: [
    {
      filename: 'apps/api/src/users/users.controller.ts',
      code: 'toPrivateUser(user, completeness);',
      errors: [{ messageId: 'restricted' }],
    },
    {
      filename: 'apps/api/src/auth/auth.controller.ts',
      code: 'const x = view.toPrivateUser(user, completeness);',
      errors: [{ messageId: 'restricted' }],
    },
  ],
});
