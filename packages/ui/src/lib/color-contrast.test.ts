import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  oklchStringToLinearRgb,
  relativeLuminance,
} from './color-contrast';

describe('oklchStringToLinearRgb', () => {
  it('parses oklch(1 0 0) as linear-light white', () => {
    const rgb = oklchStringToLinearRgb('oklch(1 0 0)');
    expect(rgb.r).toBeCloseTo(1, 5);
    expect(rgb.g).toBeCloseTo(1, 5);
    expect(rgb.b).toBeCloseTo(1, 5);
  });

  it('parses oklch(0 0 0) as linear-light black', () => {
    const rgb = oklchStringToLinearRgb('oklch(0 0 0)');
    expect(rgb.r).toBeCloseTo(0, 5);
    expect(rgb.g).toBeCloseTo(0, 5);
    expect(rgb.b).toBeCloseTo(0, 5);
  });

  it('parses an oklch string with an alpha channel, ignoring alpha', () => {
    const withAlpha = oklchStringToLinearRgb('oklch(1 0 0 / 10%)');
    const withoutAlpha = oklchStringToLinearRgb('oklch(1 0 0)');
    expect(withAlpha).toEqual(withoutAlpha);
  });
});

describe('relativeLuminance', () => {
  it('is 1 for linear-light white', () => {
    expect(relativeLuminance({ r: 1, g: 1, b: 1 })).toBeCloseTo(1, 5);
  });

  it('is 0 for linear-light black', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
  });
});

describe('contrastRatio', () => {
  it('is 21:1 between pure black and pure white (the WCAG maximum)', () => {
    const white = oklchStringToLinearRgb('oklch(1 0 0)');
    const black = oklchStringToLinearRgb('oklch(0 0 0)');
    expect(contrastRatio(white, black)).toBeCloseTo(21, 1);
  });

  it('is 1:1 for two identical colors', () => {
    const gray = oklchStringToLinearRgb('oklch(0.5 0 0)');
    expect(contrastRatio(gray, gray)).toBeCloseTo(1, 5);
  });

  it('is symmetric regardless of argument order', () => {
    const a = oklchStringToLinearRgb('oklch(0.9 0 0)');
    const b = oklchStringToLinearRgb('oklch(0.2 0 0)');
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});
