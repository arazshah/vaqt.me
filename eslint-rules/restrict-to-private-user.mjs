import { ESLintUtils } from '@typescript-eslint/utils';

// toPrivateUser() attaches maskedPhone/status/systemRole/completeness to a
// user projection and must only ever be called from the two self-view
// endpoints it was built for (GET /users/me, GET /auth/me) — see
// apps/api/src/auth/user-view.ts. Any other call site would be a
// self-view-only projection escaping into a general-purpose response.
const ALLOWED_FILES = [
  'apps/api/src/users/users.service.ts',
  'apps/api/src/auth/auth.service.ts',
];

const createRule = ESLintUtils.RuleCreator(
  () =>
    'https://github.com/arazshah/vaqt.me/blob/main/CLAUDE.md#پروجکشن-عمومی-کاربر',
);

function isAllowed(filename) {
  const normalized = filename.replace(/\\/g, '/');
  return ALLOWED_FILES.some((allowed) => normalized.endsWith(allowed));
}

export default createRule({
  name: 'restrict-to-private-user',
  meta: {
    type: 'problem',
    docs: {
      description:
        'toPrivateUser() may only be called from users.service.ts or auth.service.ts.',
    },
    schema: [],
    messages: {
      restricted:
        'toPrivateUser() may only be called from apps/api/src/users/users.service.ts or apps/api/src/auth/auth.service.ts (the two self-view endpoints it was built for) — see apps/api/src/auth/user-view.ts.',
    },
  },
  defaultOptions: [],
  create(context) {
    if (isAllowed(context.filename)) {
      return {};
    }
    return {
      CallExpression(node) {
        const callee = node.callee;
        const name =
          callee.type === 'Identifier'
            ? callee.name
            : callee.type === 'MemberExpression' &&
                callee.property.type === 'Identifier'
              ? callee.property.name
              : null;
        if (name === 'toPrivateUser') {
          context.report({ node, messageId: 'restricted' });
        }
      },
    };
  },
});
