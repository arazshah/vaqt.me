/**
 * تبدیل عدد انگلیسی به فارسی
 */
export function toPersianDigits(num: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/\d/g, (digit) => persianDigits[parseInt(digit)]);
}

/**
 * فرمت کردن عدد با جداکننده هزارگان فارسی
 */
export function formatNumber(num: number): string {
  const formatted = num.toLocaleString('en-US');
  return toPersianDigits(formatted);
}

/**
 * فرمت کردن مبلغ به تومان
 */
export function formatToman(amount: number): string {
  return `${formatNumber(amount)} تومان`;
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
