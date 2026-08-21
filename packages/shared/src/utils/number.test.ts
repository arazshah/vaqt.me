import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  formatToman,
  rialToToman,
  toPersianDigits,
  tomanToRial,
} from './number';

// Every non-ASCII character below is spelled out with an explicit \uXXXX
// escape (never a pasted literal glyph) so the exact code point under test
// is unambiguous - same discipline as normalize-fa.test.ts.
const D = [
  '\u06F0', // Extended Arabic-Indic (Persian) digit zero
  '\u06F1',
  '\u06F2',
  '\u06F3',
  '\u06F4',
  '\u06F5',
  '\u06F6',
  '\u06F7',
  '\u06F8',
  '\u06F9',
];
const THOUSANDS_SEP = '\u066C'; // ARABIC THOUSANDS SEPARATOR
const DECIMAL_SEP = '\u066B'; // ARABIC DECIMAL SEPARATOR
const LRM = '\u200E'; // LEFT-TO-RIGHT MARK
const MINUS = '\u2212'; // MINUS SIGN (not ASCII hyphen U+002D)
const TOMAN_SUFFIX = ' \u062A\u0648\u0645\u0627\u0646'; // " Toman" (Persian)

describe('formatNumber', () => {
  it('formats zero', () => {
    expect(formatNumber(0)).toBe(D[0]);
  });

  it('formats a number under 1000 without a thousands separator', () => {
    // 490 -> Persian digits 4-9-0, no separator
    expect(formatNumber(490)).toBe(D[4] + D[9] + D[0]);
  });

  it('formats a number with Persian digits and Persian thousands separators', () => {
    // 1234567 -> grouped in 3s with U+066C
    expect(formatNumber(1234567)).toBe(
      D[1] +
        THOUSANDS_SEP +
        D[2] +
        D[3] +
        D[4] +
        THOUSANDS_SEP +
        D[5] +
        D[6] +
        D[7],
    );
  });

  it('formats a decimal with the Persian decimal separator', () => {
    // 1234.5 -> grouped integer part + U+066B + fractional digit
    expect(formatNumber(1234.5)).toBe(
      D[1] + THOUSANDS_SEP + D[2] + D[3] + D[4] + DECIMAL_SEP + D[5],
    );
  });

  it('formats a negative number with a bidi-safe minus sign', () => {
    // -500 -> LRM + U+2212 minus sign + Persian digits
    expect(formatNumber(-500)).toBe(LRM + MINUS + D[5] + D[0] + D[0]);
  });
});

describe('formatToman', () => {
  it('converts a Rial amount to Toman and appends the Toman suffix', () => {
    // 490000 Rial -> 49000 Toman, formatted + suffix
    expect(formatToman(490000)).toBe(
      D[4] + D[9] + THOUSANDS_SEP + D[0] + D[0] + D[0] + TOMAN_SUFFIX,
    );
  });

  it('formats zero Rial', () => {
    expect(formatToman(0)).toBe(D[0] + TOMAN_SUFFIX);
  });

  it('floors a Rial amount that does not divide evenly by 10', () => {
    // 495 Rial -> floor(49.5) = 49 Toman
    expect(formatToman(495)).toBe(D[4] + D[9] + TOMAN_SUFFIX);
  });
});

describe('tomanToRial', () => {
  it('multiplies by 10', () => {
    expect(tomanToRial(49000)).toBe(490000);
  });

  it('handles zero', () => {
    expect(tomanToRial(0)).toBe(0);
  });
});

describe('rialToToman', () => {
  it('divides by 10', () => {
    expect(rialToToman(490000)).toBe(49000);
  });

  it('floors a value that does not divide evenly', () => {
    expect(rialToToman(495)).toBe(49);
  });
});

describe('toPersianDigits', () => {
  it('converts ASCII digits in a string to Persian digits', () => {
    expect(toPersianDigits('123')).toBe(D[1] + D[2] + D[3]);
  });

  it('accepts a number input', () => {
    expect(toPersianDigits(123)).toBe(D[1] + D[2] + D[3]);
  });

  it('leaves non-digit characters untouched', () => {
    expect(toPersianDigits('a1b2')).toBe('a' + D[1] + 'b' + D[2]);
  });
});
