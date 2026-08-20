import { describe, expect, it } from 'vitest';
import { normalizePhone } from './normalize-phone';

const CANONICAL = '+989123456789';

describe('normalizePhone', () => {
  it('accepts the 09xxxxxxxxx shape', () => {
    expect(normalizePhone('09123456789')).toBe(CANONICAL);
  });

  it('accepts the 9xxxxxxxxx shape', () => {
    expect(normalizePhone('9123456789')).toBe(CANONICAL);
  });

  it('accepts the +989xxxxxxxxx shape', () => {
    expect(normalizePhone('+989123456789')).toBe(CANONICAL);
  });

  it('accepts the 00989xxxxxxxxx shape', () => {
    expect(normalizePhone('00989123456789')).toBe(CANONICAL);
  });

  it('strips spaces', () => {
    expect(normalizePhone('0912 345 6789')).toBe(CANONICAL);
  });

  it('strips dashes', () => {
    expect(normalizePhone('0912-345-6789')).toBe(CANONICAL);
  });

  it('strips a mix of spaces and dashes around a +98 prefix', () => {
    expect(normalizePhone('+98 912-345 6789')).toBe(CANONICAL);
  });

  it('converts Persian digits (U+06F0-U+06F9) before matching', () => {
    // \u06F0\u06F9\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9 -> 09123456789
    const persianDigits =
      '\u06F0\u06F9\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9';
    expect(normalizePhone(persianDigits)).toBe(CANONICAL);
  });

  it('converts Arabic-Indic digits (U+0660-U+0669) before matching', () => {
    // \u0660\u0669\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669 -> 09123456789
    const arabicIndicDigits =
      '\u0660\u0669\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
    expect(normalizePhone(arabicIndicDigits)).toBe(CANONICAL);
  });

  it('is idempotent on an already-canonical number', () => {
    expect(normalizePhone(CANONICAL)).toBe(CANONICAL);
  });

  it('rejects a landline-shaped number (0 + 2-digit area code)', () => {
    expect(normalizePhone('0212345678')).toBeNull();
  });

  it('rejects a number one digit short', () => {
    expect(normalizePhone('0912345678')).toBeNull();
  });

  it('rejects a number one digit too long', () => {
    expect(normalizePhone('091234567890')).toBeNull();
  });

  it('rejects a non-Iran country code', () => {
    expect(normalizePhone('+19123456789')).toBeNull();
  });

  it('rejects a mobile number not starting with 9 after the trunk/country prefix', () => {
    expect(normalizePhone('08123456789')).toBeNull();
  });

  it('rejects letters mixed into the number', () => {
    expect(normalizePhone('0912345678a')).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(normalizePhone('')).toBeNull();
  });

  it('rejects a string of only whitespace and dashes', () => {
    expect(normalizePhone('  --  ')).toBeNull();
  });
});
