import { describe, expect, it } from 'vitest';
import { normalizeFa } from './normalize-fa';

// Every non-ASCII character below is spelled out with an explicit \uXXXX
// escape (never a pasted literal glyph) so the exact code point under test
// is unambiguous — this matters most for the combining diacritic marks.
describe('normalizeFa', () => {
  it('converts Arabic Yeh (U+064A) to Persian Yeh (U+06CC)', () => {
    expect(normalizeFa('\u0628\u064A\u0627\u062A')).toBe(
      '\u0628\u06CC\u0627\u062A',
    );
  });

  it('converts Arabic Kaf (U+0643) to Persian Keheh (U+06A9)', () => {
    expect(normalizeFa('\u0628\u0627\u0643')).toBe('\u0628\u0627\u06A9');
  });

  it('strips Arabic combining diacritics (harakat + tanwin)', () => {
    // ب + FATHA + ر + SUKUN + ک + KASRA + ت  ->  برکت
    const withDiacritics = '\u0628\u064E\u0631\u0652\u06A9\u0650\u062A';
    expect(normalizeFa(withDiacritics)).toBe('\u0628\u0631\u06A9\u062A');
  });

  it('strips tatweel (U+0640)', () => {
    expect(normalizeFa('\u0628\u0640\u0640\u0631')).toBe('\u0628\u0631');
  });

  it('converts Arabic-Indic digits (U+0660-U+0669) to Latin', () => {
    expect(
      normalizeFa(
        '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669',
      ),
    ).toBe('0123456789');
  });

  it('converts Persian digits (U+06F0-U+06F9) to Latin', () => {
    expect(
      normalizeFa(
        '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9',
      ),
    ).toBe('0123456789');
  });

  it('unifies ZWNJ (U+200C) to a regular space', () => {
    // م ی ZWNJ ک ن م  ->  "می کنم" spelled with a real half-space
    const withZwnj = '\u0645\u06CC\u200C\u06A9\u0646\u0645';
    expect(normalizeFa(withZwnj)).toBe('\u0645\u06CC \u06A9\u0646\u0645');
  });

  it('collapses runs of whitespace and trims the ends', () => {
    expect(normalizeFa('  a   b\tc\nd  ')).toBe('a b c d');
  });

  it('normalizes an Arabic-Yeh spelling and a Persian-Yeh spelling of the same word identically', () => {
    // پایان (with Arabic Yeh) vs پایان (with Persian Yeh)
    const withArabicYeh = '\u067E\u0627\u064A\u0627\u0646';
    const withPersianYeh = '\u067E\u0627\u06CC\u0627\u0646';
    expect(normalizeFa(withArabicYeh)).toBe(normalizeFa(withPersianYeh));
  });

  it('applies every transformation together on a realistic sentence', () => {
    // "بازنویسي" spelled with a trailing Arabic Yeh, plus a ZWNJ inside
    // "پایان‌نامه" and extra surrounding whitespace — mirrors the seed's
    // req-thesis-literature description.
    const raw = `  بازنویس\u064A پایان\u200Cنامه   `;
    expect(normalizeFa(raw)).toBe('بازنویسی پایان نامه');
  });
});
