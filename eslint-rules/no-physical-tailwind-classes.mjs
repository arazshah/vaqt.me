import { ESLintUtils } from '@typescript-eslint/utils';

// CLAUDE.md §1: logical Tailwind utilities (ps-/pe-/ms-/me-/start-/end-/
// text-start/text-end/border-s/rounded-s-*) are mandatory project-wide;
// pl/pr/ml/mr/left/right are banned so the app doesn't silently mirror
// wrong in RTL. This only catches statically-known class strings — it
// cannot see through fully dynamic values or arbitrary CSS properties
// like `[padding-left:10px]`.
const createRule = ESLintUtils.RuleCreator(
  () => 'https://github.com/arazshah/vaqt.me/blob/main/CLAUDE.md#۱-shadcnui-و-rtl',
);

const CLASS_BEARING_CALLEES = new Set([
  'cn',
  'clsx',
  'cva',
  'cx',
  'classnames',
  'twMerge',
  'twJoin',
  'tv',
]);

const VARIANT_PREFIX = '(?:[a-z0-9-]+:)*';
const BANNED_TOKEN = new RegExp(
  [
    `^${VARIANT_PREFIX}-?(?:pl|pr|ml|mr)-\\S+$`,
    `^${VARIANT_PREFIX}-?(?:left|right)-\\S+$`,
    `^${VARIANT_PREFIX}text-(?:left|right)$`,
    `^${VARIANT_PREFIX}border-[lr](?:-\\S+)?$`,
    `^${VARIANT_PREFIX}rounded-[lr](?:-\\S+)?$`,
    `^${VARIANT_PREFIX}float-(?:left|right)$`,
    `^${VARIANT_PREFIX}clear-(?:left|right)$`,
  ].join('|'),
);

function findBannedTokens(text) {
  return text.split(/\s+/).filter((token) => token && BANNED_TOKEN.test(token));
}

function isClassBearingContext(node) {
  let current = node.parent;
  while (current) {
    if (
      current.type === 'JSXAttribute' &&
      current.name?.type === 'JSXIdentifier' &&
      (current.name.name === 'className' || current.name.name === 'class')
    ) {
      return true;
    }
    if (
      current.type === 'CallExpression' &&
      current.callee.type === 'Identifier' &&
      CLASS_BEARING_CALLEES.has(current.callee.name)
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

export default createRule({
  name: 'no-physical-tailwind-classes',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Use logical Tailwind utilities (ps-/pe-/ms-/me-/start-/end-) instead of physical left/right ones, per CLAUDE.md §1.',
    },
    schema: [],
    messages: {
      physical:
        'Physical Tailwind utility "{{token}}" is banned — use the logical equivalent (ps-/pe-/ms-/me-/start-/end-/text-start/text-end/border-s/rounded-s-*) per CLAUDE.md §1.',
    },
  },
  defaultOptions: [],
  create(context) {
    function checkText(node, text) {
      for (const token of findBannedTokens(text)) {
        context.report({ node, messageId: 'physical', data: { token } });
      }
    }
    return {
      Literal(node) {
        if (typeof node.value !== 'string' || !isClassBearingContext(node)) {
          return;
        }
        checkText(node, node.value);
      },
      TemplateElement(node) {
        const text = node.value.cooked ?? node.value.raw;
        if (!text || !isClassBearingContext(node.parent)) {
          return;
        }
        checkText(node, text);
      },
    };
  },
});
