// Every Arabic/Persian-specific character below is referenced only by an
// explicit \uXXXX code point escape (never a pasted literal glyph), so the
// exact character is unambiguous and reviewable without relying on how
// combining marks happen to render in an editor.
const ARABIC_YEH = /\u064A/g; // ي -> ی
const PERSIAN_YEH = '\u06CC';
const ARABIC_KAF = /\u0643/g; // ك -> ک
const PERSIAN_KEHEH = '\u06A9';

// Arabic combining diacritics: harakat + tanwin (U+064B-U+065F), superscript
// alef (U+0670), Quranic annotation signs (U+06D6-U+06ED), tatweel (U+0640).
const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const ARABIC_INDIC_DIGIT_BASE = 0x0660;
const PERSIAN_DIGITS = /[\u06F0-\u06F9]/g;
const PERSIAN_DIGIT_BASE = 0x06f0;

const ZWNJ = /\u200C/g; // نیم‌فاصله
const WHITESPACE = /\s+/g;

/**
 * نرمال‌سازی متن فارسی برای جست‌وجوی trigram: یکسان‌سازی ی/ک عربی،
 * حذف اعراب، تبدیل ارقام فارسی/عربی به لاتین، یکسان‌سازی نیم‌فاصله و فاصله‌ها.
 */
export function normalizeFa(input: string): string {
  return input
    .replace(ARABIC_YEH, PERSIAN_YEH)
    .replace(ARABIC_KAF, PERSIAN_KEHEH)
    .replace(DIACRITICS, '')
    .replace(ARABIC_INDIC_DIGITS, (d) =>
      String(d.charCodeAt(0) - ARABIC_INDIC_DIGIT_BASE),
    )
    .replace(PERSIAN_DIGITS, (d) =>
      String(d.charCodeAt(0) - PERSIAN_DIGIT_BASE),
    )
    .replace(ZWNJ, ' ')
    .replace(WHITESPACE, ' ')
    .trim();
}
