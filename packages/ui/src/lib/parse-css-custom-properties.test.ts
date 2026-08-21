import { describe, expect, it } from 'vitest';
import { parseCssCustomProperties } from './parse-css-custom-properties';

describe('parseCssCustomProperties', () => {
  it('extracts custom properties from a single selector block', () => {
    const css = `:root {\n  --background: oklch(1 0 0);\n  --foreground: oklch(0.145 0 0);\n}`;
    expect(parseCssCustomProperties(css, ':root')).toEqual({
      '--background': 'oklch(1 0 0)',
      '--foreground': 'oklch(0.145 0 0)',
    });
  });

  it('only extracts properties from the requested selector, not others in the same file', () => {
    const css = `:root {\n  --background: oklch(1 0 0);\n}\n.dark {\n  --background: oklch(0.145 0 0);\n}`;
    expect(parseCssCustomProperties(css, '.dark')).toEqual({
      '--background': 'oklch(0.145 0 0)',
    });
  });

  it('throws when the selector is not found', () => {
    expect(() => parseCssCustomProperties(':root {}', '.missing')).toThrow();
  });
});
