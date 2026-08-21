/**
 * تبدیل عدد انگلیسی به فارسی
 */
export function toPersianDigits(num: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/\d/g, (digit) => persianDigits[parseInt(digit)]);
}

const persianNumberFormatter = new Intl.NumberFormat('fa-IR');

/**
 * فرمت کردن عدد با ارقام و جداکننده‌های هزارگان/اعشار فارسی (fa-IR بومی،
 * نه جایگزینی دستی ارقام روی جداکننده‌ی انگلیسی)
 */
export function formatNumber(num: number): string {
  return persianNumberFormatter.format(num);
}

/**
 * تبدیل مبلغ ریال (واحد ذخیره‌شده در دیتابیس) به تومان و فرمت کردن با پسوند
 * «تومان» — تنها نقطه‌ی تبدیل ریال→تومان مجاز در لایه‌ی نمایش؛ ورودی همیشه
 * ریال است، نه تومان (به بند «مبالغ» در CLAUDE.md مراجعه شود)
 */
export function formatToman(rial: number): string {
  return `${formatNumber(rialToToman(rial))} تومان`;
}

/**
 * تبدیل تومان به ریال (برای درگاه پرداخت)
 */
export function tomanToRial(toman: number): number {
  return toman * 10;
}

/**
 * تبدیل ریال به تومان
 */
export function rialToToman(rial: number): number {
  return Math.floor(rial / 10);
}
