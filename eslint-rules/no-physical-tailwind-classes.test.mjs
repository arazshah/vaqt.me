import tsParser from '@typescript-eslint/parser';
import { RuleTester } from '@typescript-eslint/rule-tester';
import rule from './no-physical-tailwind-classes.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run('no-physical-tailwind-classes', rule, {
  valid: [
    { code: '<div className="ps-4 pe-2 ms-auto me-0 start-0 end-4" />' },
    { code: '<div className="text-start text-end border-s rounded-s-lg" />' },
    { code: '<div className={cn("ps-4", isActive && "bg-primary")} />' },
    { code: '<div className={`ps-4 ${extra}`} />' },
    // not a className/class-bearing context at all — plain string elsewhere
    { code: 'const path = "pl-4/segment/right-here";' },
    // "l"/"r" immediately followed by a non-hyphen, non-end char: not a
    // direction suffix (border-red-500, rounded-lg are real utilities)
    { code: '<div className="border-red-500 rounded-lg bg-white" />' },
    { code: 'const classes = cva("rounded-lg border-rose-200");' },
  ],
  invalid: [
    {
      code: '<div className="pl-4" />',
      errors: [{ messageId: 'physical', data: { token: 'pl-4' } }],
    },
    {
      code: '<div className="mr-2 flex" />',
      errors: [{ messageId: 'physical', data: { token: 'mr-2' } }],
    },
    {
      code: '<div className="-ml-2" />',
      errors: [{ messageId: 'physical', data: { token: '-ml-2' } }],
    },
    {
      code: '<div className="md:pl-4 hover:mr-2" />',
      errors: [
        { messageId: 'physical', data: { token: 'md:pl-4' } },
        { messageId: 'physical', data: { token: 'hover:mr-2' } },
      ],
    },
    {
      code: '<div className="left-0" />',
      errors: [{ messageId: 'physical', data: { token: 'left-0' } }],
    },
    {
      code: '<div className="dark:right-0" />',
      errors: [{ messageId: 'physical', data: { token: 'dark:right-0' } }],
    },
    {
      code: '<div className="text-left" />',
      errors: [{ messageId: 'physical', data: { token: 'text-left' } }],
    },
    {
      code: '<div className="border-l border-r-2" />',
      errors: [
        { messageId: 'physical', data: { token: 'border-l' } },
        { messageId: 'physical', data: { token: 'border-r-2' } },
      ],
    },
    {
      code: '<div className="rounded-l-lg rounded-r" />',
      errors: [
        { messageId: 'physical', data: { token: 'rounded-l-lg' } },
        { messageId: 'physical', data: { token: 'rounded-r' } },
      ],
    },
    {
      code: '<div className={cn("pl-4", isActive && "bg-primary")} />',
      errors: [{ messageId: 'physical', data: { token: 'pl-4' } }],
    },
    {
      code: '<div className={`pl-4 ${extra}`} />',
      errors: [{ messageId: 'physical', data: { token: 'pl-4' } }],
    },
    {
      code: 'const classes = cva("rounded-lg", { variants: { side: { left: "ml-2" } } });',
      errors: [{ messageId: 'physical', data: { token: 'ml-2' } }],
    },
  ],
});
