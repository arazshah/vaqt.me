// Canonicalizes an Iranian mobile number to +989xxxxxxxxx, or returns null
// for anything that doesn't unambiguously match one of the four accepted
// shapes: 09xxxxxxxxx, 9xxxxxxxxx, +989xxxxxxxxx, 00989xxxxxxxxx (digits may
// be Persian/Arabic, with spaces or dashes anywhere).
//
// Digit ranges below are referenced only by explicit \uXXXX code point
// escapes (never a pasted literal glyph) — same discipline as normalizeFa().
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const ARABIC_INDIC_DIGIT_BASE = 0x0660;
const PERSIAN_DIGITS = /[\u06F0-\u06F9]/g;
const PERSIAN_DIGIT_BASE = 0x06f0;

function toLatinDigits(input: string): string {
  return input
    .replace(ARABIC_INDIC_DIGITS, (d) =>
      String(d.charCodeAt(0) - ARABIC_INDIC_DIGIT_BASE),
    )
    .replace(PERSIAN_DIGITS, (d) =>
      String(d.charCodeAt(0) - PERSIAN_DIGIT_BASE),
    );
}

const ACCEPTED_SHAPES: RegExp[] = [
  /^09(\d{9})$/, // 09xxxxxxxxx
  /^9(\d{9})$/, // 9xxxxxxxxx
  /^\+989(\d{9})$/, // +989xxxxxxxxx
  /^00989(\d{9})$/, // 00989xxxxxxxxx
];

/**
 * نرمال‌سازی شماره موبایل ایران به شکل canonical `+989xxxxxxxxx`.
 * ورودی‌های مجاز: 09xxxxxxxxx، 9xxxxxxxxx، +989xxxxxxxxx، 00989xxxxxxxxx —
 * با ارقام فارسی/عربی، فاصله یا خط تیره. هر چیز دیگری null برمی‌گرداند.
 */
export function normalizePhone(input: string): string | null {
  const cleaned = toLatinDigits(input).replace(/[\s-]+/g, '');

  for (const shape of ACCEPTED_SHAPES) {
    const match = shape.exec(cleaned);
    if (match) {
      return `+989${match[1]}`;
    }
  }

  return null;
}
