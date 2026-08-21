import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { contrastRatio, oklchStringToLinearRgb } from '../lib/color-contrast';
import { parseCssCustomProperties } from '../lib/parse-css-custom-properties';

// Reads the real globals.css from disk so this test tracks the actual
// shipped tokens — a color changed in globals.css without updating this
// file will fail here, not silently ship a contrast regression.
const globalsCssPath = fileURLToPath(new URL('./globals.css', import.meta.url));
const globalsCss = readFileSync(globalsCssPath, 'utf-8');

const lightTokens = parseCssCustomProperties(globalsCss, ':root');
const darkTokens = parseCssCustomProperties(globalsCss, '.dark');

// WCAG 2.x AA for normal-size text (everything this design system uses
// these token pairs for is below the 18pt/14pt-bold "large text"
// threshold, so the stricter 4.5:1 applies uniformly).
const WCAG_AA_NORMAL_TEXT = 4.5;

// [text token, background token] pairs actually used as solid
// text-on-solid-background combinations in this design system's
// components (Card, Popover, Button, Badge, FormMessage, muted body
// text). This is not an exhaustive non-text (border/UI outline)
// contrast audit — WCAG 1.4.11 is out of scope here.
const TEXT_ON_BACKGROUND_PAIRS: Array<[string, string]> = [
  ['--foreground', '--background'],
  ['--card-foreground', '--card'],
  ['--popover-foreground', '--popover'],
  ['--primary-foreground', '--primary'],
  ['--secondary-foreground', '--secondary'],
  ['--accent-foreground', '--accent'],
  ['--muted-foreground', '--background'],
  ['--muted-foreground', '--card'],
  ['--destructive', '--background'],
  ['--destructive', '--card'],
];

describe.each([
  ['light', lightTokens],
  ['dark', darkTokens],
])(
  '%s theme contrast (WCAG AA, normal text, >= 4.5:1)',
  (_themeName, tokens) => {
    it.each(TEXT_ON_BACKGROUND_PAIRS)('%s on %s', (textVar, bgVar) => {
      const textValue = tokens[textVar];
      const bgValue = tokens[bgVar];
      expect(textValue, `${textVar} not found in this theme`).toBeDefined();
      expect(bgValue, `${bgVar} not found in this theme`).toBeDefined();

      const ratio = contrastRatio(
        oklchStringToLinearRgb(textValue),
        oklchStringToLinearRgb(bgValue),
      );

      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
    });
  },
);
