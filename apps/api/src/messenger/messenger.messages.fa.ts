export const baleMessagesFa = {
  linked: (name: string) =>
    `✅ حساب «${name}» به وقت من وصل شد.\nرزروهای جدید از این به بعد همین‌جا می‌آید.`,
  linkInvalid:
    'این کد معتبر نیست یا منقضی شده. از صفحه‌ی «رزروها» در وقت من یک کد تازه بگیرید.',
  help: 'سلام 👋\nبرای وصل شدن، در وقت من از صفحه‌ی «رزروها» دکمه‌ی «اتصال به بله» را بزنید و کد را اینجا بفرستید:\n/start کد',
  confirmButton: '✅ تأیید',
  rejectButton: '❌ رد',
  notLinked: 'ابتدا حساب خود را به ربات وصل کنید.',
  decidedConfirm: '\n\n✅ تأیید شد. به رزروکننده اطلاع داده شد.',
  decidedReject: '\n\n❌ رد شد. به رزروکننده اطلاع داده شد.',
  notPending: 'این رزرو دیگر در انتظار تصمیم نیست.',
  genericError: 'عملیات انجام نشد. از داخل وقت من اقدام کنید.',
  // ---- booking confirmation by a visitor (no account) ----
  draftInvalid:
    'این درخواست رزرو منقضی شده یا قبلاً استفاده شده است. از صفحه‌ی کارت دوباره رزرو کنید.',
  draftSummary: (p: {
    provider: string;
    service: string;
    when: string;
    name: string;
  }) =>
    `📅 رزرو وقت با ${p.provider}\n${p.service}\n${p.when}\nبه نام: ${p.name}`,
  shareContactPrompt:
    '\n\nبرای ثبت رزرو، شماره‌ی موبایل خودتان را با دکمه‌ی زیر بفرستید.',
  shareContactButton: '📱 ارسال شماره و ثبت رزرو',
  confirmBookingPrompt: '\n\nبرای ثبت رزرو دکمه‌ی زیر را بزنید.',
  confirmBookingButton: '✅ ثبت رزرو',
  contactWithoutDraft:
    'درخواست رزرو فعالی پیدا نشد. از صفحه‌ی کارت دوباره رزرو کنید.',
  contactNotOwn:
    'فقط شماره‌ی خودتان پذیرفته می‌شود. با دکمه‌ی ارسال شماره بفرستید.',
  contactInvalid: 'فقط شماره‌ی موبایل ایران پذیرفته می‌شود.',
  bookingCreated: (link: string) =>
    `✅ درخواست رزرو ثبت شد. بعد از تأیید متخصص همین‌جا خبر می‌دهیم.\nپیگیری: ${link}`,
  cancelButton: '🚫 لغو رزرو',
  canceled: '\n\n🚫 لغو شد.',
  notCancellable: 'این رزرو دیگر قابل لغو نیست.',
};
