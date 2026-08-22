import type { RequestMode, RequestStatus } from '@vaqt/shared';

/**
 * Every user-facing Persian string in apps/web lives here — no hardcoded
 * Persian strings in components (see CLAUDE.md).
 */
export const fa = {
  appShell: {
    brand: 'وقت‌می',
    nav: {
      home: 'خانه',
      requests: 'درخواست‌ها',
    },
  },
  requestStatus: {
    DRAFT: 'پیش‌نویس',
    PUBLISHED: 'منتشرشده',
    OFFER_SELECTED: 'پیشنهاد انتخاب‌شده',
    CLOSED: 'بسته‌شده',
    EXPIRED: 'منقضی‌شده',
    REMOVED: 'حذف‌شده',
  } satisfies Record<RequestStatus, string>,
  requestMode: {
    ONLINE: 'آنلاین',
    IN_PERSON: 'حضوری',
    HYBRID: 'ترکیبی',
  } satisfies Record<RequestMode, string>,
  requestCard: {
    offerCount: (count: string) => `${count} پیشنهاد`,
    budgetHidden: 'بودجه پنهان',
  },
  requestsPage: {
    title: 'درخواست‌های منتشرشده',
    emptyTitle: 'هنوز درخواستی منتشر نشده',
    emptyDescription: 'به‌زودی درخواست‌های تازه اینجا نمایش داده می‌شوند.',
    errorTitle: 'مشکلی در دریافت فهرست پیش آمد',
    errorDescription: 'اتصال به سرور برقرار نشد. کمی بعد دوباره تلاش کنید.',
  },
  devUi: {
    title: 'گالری سیستم طراحی',
    description:
      'صفحه‌ی داخلی برای بازبینی بصری کامپوننت‌ها با داده‌ی ساختگی — بدون تماس API.',
    sections: {
      buttons: 'دکمه‌ها',
      badges: 'نشان‌ها',
      formFields: 'فیلدهای فرم',
      bidiField: 'فیلد دوجهته (شماره موبایل)',
      avatars: 'آواتار',
      cards: 'کارت درخواست',
      overlays: 'دیالوگ و شیت',
      tabs: 'تب‌ها',
      pagination: 'صفحه‌بندی',
      states: 'وضعیت‌های بارگذاری و خالی',
      price: 'برچسب قیمت',
    },
    labels: {
      phoneNumber: 'شماره موبایل',
      selectCategory: 'انتخاب دسته',
      selectCategoryPlaceholder: 'یک دسته را انتخاب کنید',
      notes: 'یادداشت',
      agreeToTerms: 'قوانین را می‌پذیرم',
      notifyMe: 'اطلاع‌رسانی فعال باشد',
      openDialog: 'باز کردن دیالوگ',
      openSheet: 'باز کردن شیت',
      dialogTitle: 'عنوان دیالوگ',
      dialogDescription: 'این یک دیالوگ نمونه با داده‌ی ساختگی است.',
      sheetTitle: 'عنوان شیت',
      sheetDescription: 'این یک شیت نمونه با داده‌ی ساختگی است.',
      emptyStateTitle: 'هیچ درخواستی پیدا نشد',
      emptyStateDescription: 'با تغییر فیلترها دوباره امتحان کنید.',
      loading: 'در حال بارگذاری…',
    },
  },
} as const;
