import { ESLintUtils } from '@typescript-eslint/utils';

// Discriminator properties that only ever appear together on the raw
// Prisma User model (@vaqt/db) — never on PublicUser (see
// apps/api/src/auth/user-view.ts). If a controller method's return type
// (after unwrapping Promise<T>/Array<T>) structurally has all of these,
// it's leaking the raw entity instead of going through toPublicUser().
const RAW_USER_MARKERS = ['phone', 'phoneVerifiedAt', 'systemRole'];

const createRule = ESLintUtils.RuleCreator(
  () =>
    'https://github.com/arazshah/vaqt.me/blob/main/CLAUDE.md#پروجکشن-عمومی-کاربر',
);

function unwrap(type, checker) {
  // Promise<T> -> T
  if (type.symbol?.name === 'Promise' && type.aliasTypeArguments === undefined) {
    const args = checker.getTypeArguments(type);
    if (args.length === 1) {
      return unwrap(args[0], checker);
    }
  }
  // T[] -> T
  if (checker.isArrayType?.(type)) {
    const args = checker.getTypeArguments(type);
    if (args.length === 1) {
      return unwrap(args[0], checker);
    }
  }
  return type;
}

function markersOn(type, checker) {
  const properties = checker.getPropertiesOfType(type).map((p) => p.name);
  return RAW_USER_MARKERS.filter((m) => properties.includes(m));
}

// Checks the return type itself, then one level of its own properties'
// types (unwrapped the same way) — covers both `return user;` and the
// far more common `return { user, ...other };` wrapper pattern used
// throughout this codebase's services (e.g. `{ user: PublicUser,
// completeness }`), without going fully recursive.
function findLeak(type, checker) {
  const direct = markersOn(type, checker);
  if (direct.length === RAW_USER_MARKERS.length) {
    return direct;
  }
  for (const prop of checker.getPropertiesOfType(type)) {
    const declaration = prop.valueDeclaration ?? prop.declarations?.[0];
    if (!declaration) continue;
    const propType = unwrap(
      checker.getTypeOfSymbolAtLocation(prop, declaration),
      checker,
    );
    const nested = markersOn(propType, checker);
    if (nested.length === RAW_USER_MARKERS.length) {
      return nested;
    }
  }
  return [];
}

export default createRule({
  name: 'no-raw-user-return',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Controller methods must never return the raw Prisma User entity — always project through toPublicUser().',
    },
    schema: [],
    messages: {
      rawUser:
        'This return value structurally matches the raw User entity (has {{markers}}). Route handlers must return toPublicUser(...) (or a type built from it), never the raw entity — see apps/api/src/auth/user-view.ts.',
    },
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    function check(node, expression) {
      if (!expression) return;
      const tsNode = services.esTreeNodeToTSNodeMap.get(expression);
      const type = unwrap(checker.getTypeAtLocation(tsNode), checker);
      const present = findLeak(type, checker);
      if (present.length > 0) {
        context.report({
          node,
          messageId: 'rawUser',
          data: { markers: present.join(', ') },
        });
      }
    }

    return {
      ReturnStatement(node) {
        check(node, node.argument);
      },
      'ArrowFunctionExpression[body.type!="BlockStatement"]'(node) {
        check(node, node.body);
      },
    };
  },
});
