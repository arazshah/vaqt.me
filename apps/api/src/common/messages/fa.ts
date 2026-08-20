import { ErrorCode } from '../errors/error-codes';

export const errorMessagesFa: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'داده‌های ارسالی نامعتبر است.',
  PHONE_INVALID: 'شماره موبایل واردشده معتبر نیست.',
  OTP_RATE_LIMITED:
    'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.',
  OTP_EXPIRED: 'کد تأیید منقضی شده است. لطفاً دوباره درخواست دهید.',
  OTP_INVALID: 'کد تأیید نادرست است.',
  PHONE_BLOCKED:
    'به دلیل تلاش‌های ناموفق مکرر، این شماره موقتاً مسدود شده است.',
  UNAUTHORIZED: 'برای این عملیات ابتدا وارد شوید.',
  SESSION_INVALID: 'نشست شما نامعتبر است. لطفاً دوباره وارد شوید.',
  SESSION_REUSE_DETECTED:
    'یک فعالیت مشکوک در نشست شما شناسایی شد؛ برای امنیت، از همه‌ی دستگاه‌ها خارج شدید.',
  PHONE_NOT_VERIFIED: 'برای این عملیات باید شماره موبایل خود را تأیید کنید.',
  FORBIDDEN: 'اجازه‌ی دسترسی به این بخش را ندارید.',
  NOT_FOUND: 'مورد درخواستی یافت نشد.',
  INTERNAL_ERROR: 'خطایی پیش‌آمد. لطفاً بعداً دوباره تلاش کنید.',
};
