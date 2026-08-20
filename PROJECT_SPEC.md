# PROJECT SPEC — Vaqt.me

> این فایل، منبع حقیقت (Source of Truth) پروژه است. در هر فاز به آن رجوع کن و در پایان هر فاز، فایل `CLAUDE.md` را با وضعیت فعلی به‌روز کن.

---

## ۱. هویت و ماهیت محصول

**Vaqt.me** یک بازار دوطرفه (Marketplace) فارسی و راست‌چین برای «خرید و فروش دقیقه‌های انسانی» است.
شعار: «چند دقیقه از وقت یک آدمِ درست»

تفاوت بنیادین آن با سیستم‌های نوبت‌دهی متداول:
پلتفرم **فهرست متخصص** ندارد. کاربر ابتدا **نیاز** خود را منتشر می‌کند و ارائه‌دهندگان برای آن نیاز **پیشنهاد خصوصی** می‌فرستند. انتخاب نهایی با درخواست‌کننده است.

### قوانین بنیادین محصول (این‌ها را هرگز نقض نکن)

1. **بدون کمیسیون و بدون واسطه‌ی مالی.** هیچ پرداختی بین دو کاربر از داخل پلتفرم انجام نمی‌شود. درگاه پرداخت **فقط** برای خرید ارتقاهای پلتفرم (نشان فوری، نردبان، برجسته‌سازی، اشتراک) استفاده می‌شود.
2. **هویت فقط با شماره موبایل + کد پیامکی.** بدون ایمیل، بدون رمز عبور، بدون لاگین شبکه اجتماعی.
3. **افشای تدریجی اطلاعات (Progressive Disclosure):** بازه‌ی بودجه‌ی یک درخواست، فقط برای کاربرانی نمایش داده می‌شود که هویت‌شان تأیید شده و نقش ارائه‌دهنده دارند. برای مهمان و کاربر تأییدنشده، همیشه Mask می‌شود.
4. **پیشنهادها خصوصی‌اند.** یک ارائه‌دهنده هرگز نمی‌تواند پیشنهاد ارائه‌دهنده‌ی دیگر را ببیند. فقط صاحب درخواست همه‌ی پیشنهادها را می‌بیند.
5. **گفتگو فقط بعد از انتخاب.** کانال چت تنها زمانی باز می‌شود که صاحب درخواست یک پیشنهاد را رسماً انتخاب کند.
6. **قابل اشتراک‌گذاری در لینکدین.** هر درخواست یک صفحه‌ی عمومی با URL کوتاه و OG Image داینامیک دارد.

---

## ۲. پشته‌ی فناوری (الزامی)

| لایه             | فناوری                                                                       |
| ---------------- | ---------------------------------------------------------------------------- |
| ساختار           | Monorepo با pnpm workspaces + Turborepo                                      |
| Backend          | NestJS 10 (TypeScript strict)                                                |
| ORM / DB         | Prisma + PostgreSQL 16                                                       |
| Cache / Queue    | Redis 7 + BullMQ                                                             |
| Frontend         | Next.js (App Router) + React + TypeScript strict                             |
| استایل           | TailwindCSS + shadcn/ui (کاملاً RTL-شده)                                     |
| فرم و اعتبارسنجی | react-hook-form + zod (اسکیماهای مشترک در `packages/shared`)                 |
| Data fetching    | TanStack Query + Server Components                                           |
| چت               | Socket.IO (namespace اختصاصی با JWT auth)                                    |
| احراز هویت       | JWT (access کوتاه‌مدت + refresh) در کوکی httpOnly + SameSite=Lax             |
| تاریخ            | `dayjs` + پلاگین `jalaliday` — نمایش همه‌ی تاریخ‌ها شمسی                     |
| فونت             | Vazirmatn (self-hosted در `public/fonts`، بدون CDN)                          |
| تست              | Jest (unit) + Supertest (e2e API) + Playwright (smoke وب)                    |
| کیفیت کد         | ESLint + Prettier + Husky + lint-staged + Commitlint                         |
| Dev infra        | Docker Compose برای Postgres و Redis (فقط زیرساخت، اپ‌ها روی هاست اجرا شوند) |

### ساختار پوشه‌ها

```
vaqt/
├─ apps/
│  ├─ api/                 # NestJS
│  └─ web/                 # Next.js
├─ packages/
│  ├─ shared/              # types, zod schemas, enums, constants, utils
│  └─ ui/                  # design system components
├─ docker-compose.yml
├─ turbo.json
├─ pnpm-workspace.yaml
├─ .env.example
├─ CLAUDE.md
└─ PROJECT_SPEC.md
```

---

## ۳. مدل داده (Prisma Schema)

مدل‌های زیر را پیاده کن. نام فیلدها انگلیسی، مقادیر enum انگلیسی، فقط محتوای نمایشی فارسی.

- **User**: `id`, `phone` (unique, `^09\d{9}$`), `phoneVerifiedAt`, `displayName`, `avatarUrl`, `bio`, `roleIntent` (SEEKER | PROVIDER | BOTH), `status` (ACTIVE | SUSPENDED), `lastSeenAt`, timestamps
- **VerificationCode**: `id`, `phone`, `codeHash` (bcrypt — هرگز کد خام ذخیره نشود)، `purpose`, `attempts`, `expiresAt`, `consumedAt`, `ip`
- **Category** و **Skill**: درخت دو سطحی با seed فارسی (دانشگاهی، برنامه‌نویسی، کسب‌وکار، مهاجرت، طراحی، حقوقی، سلامت، ...)
- **Request**: `id`, `slug` (nanoid کوتاه برای URL)، `ownerId`, `title`, `description`, `categoryId`, `skills[]`, `mode` (ONLINE | IN_PERSON | HYBRID)، `city` (nullable)، `durationMinutes`, `budgetMin`, `budgetMax`, `currency` (IRT)، `deadlineAt` (مهلت دریافت پیشنهاد)، `preferredWindows` (Json — بازه‌های زمانی پیشنهادی)، `status` (DRAFT | PUBLISHED | OFFER_SELECTED | CLOSED | EXPIRED | REMOVED)، `viewCount`, `offerCount`, `isUrgent`, `isFeatured`, `bumpedAt`, `publishedAt`
- **AiSession**: `id`, `userId`, `requestId?`, `messages` (Json[])، `extractedDraft` (Json)، `tokensUsed`, `provider`
- **Offer**: `id`, `requestId`, `providerId`, `proposedStartAt`, `proposedDurationMinutes`, `price`, `message`, `status` (PENDING | SELECTED | REJECTED | WITHDRAWN | EXPIRED)، `createdAt` — **قید یکتایی روی (requestId, providerId)**
- **Conversation**: `id`, `requestId`, `offerId` (unique)، `seekerId`, `providerId`, `status` (OPEN | ARCHIVED)، `lastMessageAt`
- **Message**: `id`, `conversationId`, `senderId?` (null = پیام سیستمی)، `type` (TEXT | SYSTEM)، `body`, `readAt`
- **Review**: `id`, `conversationId` (unique per reviewer)، `reviewerId`, `revieweeId`, `rating` (1..5)، `comment`, `isVisible`
- **Product**: کاتالوگ ارتقاها → `code` (URGENT_BADGE | BUMP | FEATURE | PRO_MONTHLY | TARGETED_NOTIFY)، `title`, `description`, `priceIRT`, `durationHours?`
- **Order**: `id`, `userId`, `productId`, `requestId?`, `amountIRT`, `status` (PENDING | PAID | FAILED | CANCELED | REFUNDED)، `provider` (ZARINPAL | MOCK)، `authority`, `refId`, `paidAt`, `raw` (Json)
- **Entitlement**: نتیجه‌ی سفارش پرداخت‌شده → `userId`, `requestId?`, `type`, `startsAt`, `expiresAt`, `meta` (Json)
- **Subscription**: `userId`, `plan`, `status`, `currentPeriodEnd`, `orderId`
- **Notification**: `userId`, `type`, `payload` (Json)، `readAt`, `channels` (IN_APP | SMS)
- **AuditLog** و **Report**: برای گزارش تخلف و ردگیری اقدامات حساس

مبالغ همه به‌صورت **Integer و بر حسب تومان** ذخیره شوند (تبدیل به ریال فقط در لحظه‌ی ارسال به زرین‌پال).

---

## ۴. قواعد منطق کسب‌وکار

1. **OTP**: کد ۵ رقمی، انقضا ۲ دقیقه، حداکثر ۵ تلاش برای هر کد، حداکثر ۳ ارسال در ۱۰ دقیقه برای هر شماره و هر IP (با Redis). پس از ۵ تلاش ناموفق، شماره ۱۵ دقیقه قفف شود.
2. **Masking بودجه**: در لایه‌ی Serializer/Interceptor سمت API انجام شود، نه در فرانت. اگر کاربر شرایط دیدن را ندارد، فیلدهای `budgetMin/Max` از پاسخ **حذف** شوند و `budgetMasked: true` برگردد. هرگز داده‌ی محرمانه به کلاینت نرود و در UI پنهان نشود.
3. **ارسال پیشنهاد**: فقط کاربر با `phoneVerifiedAt != null`، فقط روی درخواست `PUBLISHED`، فقط قبل از `deadlineAt`، و صاحب درخواست نمی‌تواند برای درخواست خودش پیشنهاد بدهد. سقف ۵ پیشنهاد فعال هم‌زمان برای کاربران بدون اشتراک حرفه‌ای.
4. **انتخاب پیشنهاد**: با انتخاب یک پیشنهاد، در یک تراکنش دیتابیس: پیشنهاد `SELECTED`، بقیه `REJECTED`، درخواست `OFFER_SELECTED`، یک `Conversation` ساخته شود و **اولین پیام به‌صورت پیام سیستمی** درج شود با متن:
   > «توافق نهایی زمان، مدت و پرداخت مستقیماً بین شما دو نفر انجام می‌شود؛ Vaqt.me در معامله دخالتی ندارد.»
   > سپس نوتیفیکیشن درون‌برنامه‌ای + پیامک به ارائه‌دنده‌ی انتخاب‌شده ارسال شود.
5. **ارتقاها**: بعد از پرداخت موفق و **verify** زرین‌پال، یک `Entitlement` ساخته شود و اثرش روی درخواست اعمال شود (`isUrgent`, `isFeatured`) و برای «نردبان» یک Job تکرارشونده در BullMQ ثبت شود که هر N ساعت `bumpedAt` را به‌روز کند تا سقف تعداد مشخص.
6. **مرتب‌سازی فهرست فرصت‌ها**: اولویت با `isFeatured` سپس `isUrgent` سپس `bumpedAt` سپس `publishedAt` — همیشه نزولی. مرتب‌سازی نباید قابل دستکاری از سمت کلاینت باشد.
7. **اعلان هدفمند**: با انتشار هر درخواست، یک Job صف شود که ارائه‌دهندگان هم‌دسته و هم‌شهر را پیدا کرده و به آن‌ها اعلان درون‌برنامه‌ای (و برای مشترکان حرفه‌ای، پیامک) بفرستد. سقف روزانه پیامک برای هر کاربر رعایت شود.
8. **انقضای خودکار**: Job زمان‌بندی‌شده که درخواست‌های گذشته از `deadlineAt` را `EXPIRED` و پیشنهادهای معلق‌شان را `EXPIRED` کند.

---

## ۵. API (NestJS Modules)

هر ماژول شامل controller، service، dto با zod/class-validator، guard و تست.

```
auth/         POST /auth/otp/request     POST /auth/otp/verify
              POST /auth/refresh         POST /auth/logout        GET /auth/me
users/        GET|PATCH /users/me        GET /users/:id/public
requests/     POST /requests (draft)     PATCH /requests/:id      POST /requests/:id/publish
              GET  /requests            (فهرست عمومی + فیلتر و صفحه‌بندی cursor-based)
              GET  /requests/:slug       DELETE /requests/:id
              GET  /requests/mine
ai/           POST /ai/clarify           POST /ai/draft
offers/       POST /requests/:id/offers  GET /requests/:id/offers (فقط مالک)
              GET  /offers/mine          POST /offers/:id/withdraw
              POST /offers/:id/select    (فقط مالک درخواست)
chat/         GET  /conversations        GET /conversations/:id/messages
              POST /conversations/:id/messages     WS: /ws/chat
reviews/      POST /conversations/:id/review       GET /users/:id/reviews
billing/      GET  /products             POST /orders
              POST /payments/zarinpal/request      GET /payments/zarinpal/callback
              GET  /orders/mine          GET /entitlements/mine
notifications/GET  /notifications        POST /notifications/:id/read
health/       GET  /health  (db + redis)
```

- Swagger روی `/docs` فعال باشد.
- همه‌ی پاسخ‌های خطا با فرمت یکسان و **پیام خطای فارسی قابل نمایش** به کاربر (`{ code, message, details? }`).
- ValidationPipe سراسری با whitelist و forbidNonWhitelisted.
- Helmet، CORS محدود به origin وب، ThrottlerGuard سراسری.

---

## ۶. صفحات فرانت‌اند (Next.js App Router)

طراحی **Mobile-first**. در موبایل یک Bottom Navigation با ۴ آیتم (خانه / فرصت‌ها / درخواست جدید / گفتگوها / پروفایل) و در دسکتاپ هدر افقی.

| مسیر                                              | توضیح                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                               | صفحه فرود: هیرو با تیتر «چند دقیقه از وقت یک آدمِ درست»، زیرتیتر «بازار دقیقه‌های انسانی، بدون واسطه در معامله»، باکس ورودی AI با placeholder «مثلاً: به یک نفر برای بازبینی پایان‌نامه‌ام نیاز دارم...» و دکمه «تحلیل با AI»، سه کارت آماری، ردیف کارت‌های درخواست نمونه، بخش «چگونه کار می‌کند» سه مرحله‌ای، فوتر              |
| `/auth`                                           | ورود/ثبت‌نام: فیلد موبایل با پیش‌شماره ‎+۹۸‎، دکمه «دریافت کد پیامکی»، زیرمتن «هویت شما فقط با شماره موبایل تأیید می‌شود، بدون نیاز به ایمیل»                                                                                                                                                                                    |
| `/auth/verify`                                    | ۵ خانه‌ی OTP با Auto-focus و Paste، شمارنده‌ی معکوس، دکمه ارسال مجدد                                                                                                                                                                                                                                                             |
| `/onboarding`                                     | انتخاب نقش با دو کارت بزرگ: «می‌خواهم وقت بگیرم» / «می‌خواهم وقت بدهم» + انتخاب حوزه‌های تخصصی                                                                                                                                                                                                                                   |
| `/requests/new`                                   | ویزارد سه‌مرحله‌ای: (۱) گفتگو با AI (۲) تنظیم جزئیات (۳) انتشار — با **Live Preview** کارت درخواست در سمت چپ دسکتاپ و به‌صورت Sticky Bottom Sheet در موبایل. نوار پیشرفت با برچسب‌های «توضیح نیاز / تنظیم جزئیات / انتشار»                                                                                                       |
| `/opportunities`                                  | فهرست فرصت‌ها: نوار جست‌وجو + چیپ‌های فیلتر «آنلاین، حضوری، امروز، این هفته، حوزه» + گرید کارت‌ها (۳ ستون دسکتاپ، ۱ ستون موبایل) با بج‌های «فوری» نارنجی و «ارتقایافته» بنفش، Infinite Scroll، Skeleton loading                                                                                                                  |
| `/r/[slug]`                                       | جزئیات درخواست: عنوان، بج‌های اطلاعاتی، توضیحات، باکس بودجه‌ی قفل‌شده با آیکون قفل و متن «بودجه دقیق پس از تأیید هویت شما نمایش داده می‌شود»، فرم ارسال پیشنهاد در Bottom Sheet موبایل / Sidebar دسکتاپ با دکمه «ارسال پیشنهاد به‌صورت خصوصی» و زیرمتن «فقط صاحب درخواست پیشنهاد شما را می‌بیند»، دکمه «اشتراک‌گذاری در لینکدین» |
| `/dashboard`                                      | تب‌های «درخواست‌های من / پیشنهادهای دریافتی / تاریخچه»؛ کارت‌های پیشنهاد با آواتار، بج سبز «هویت تأیید‌شده»، زمان و مدت و قیمت، امتیاز، و دو دکمه «مشاهده پروفایل کامل» و «انتخاب و شروع گفتگو»؛ کارت انتخاب‌شده با حاشیه سبز و بج «انتخاب‌شده»                                                                                  |
| `/dashboard/offers`                               | پیشنهادهای ارسالی من با وضعیت هرکدام                                                                                                                                                                                                                                                                                             |
| `/chat` و `/chat/[id]`                            | لیست گفتگوها + صفحه چت با هدر (آواتار، نام، بج سبز «هویت تأیید‌شده با شماره موبایل»)، پیام سیستمی بنفش کم‌رنگ در ابتدای گفتگو، حباب‌های چت، نوار ورودی با آیکون ارسال، وضعیت آنلاین و typing                                                                                                                                     |
| `/profile`                                        | پروفایل عمومی، آمار «۲۳ همکاری موفق»، نظرات دریافتی                                                                                                                                                                                                                                                                              |
| `/profile/upgrades`                               | چهار کارت ارتقا (نشان فوری / نردبان / برجسته‌سازی / اشتراک حرفه‌ای ماهانه) با آیکون، توضیح، قیمت و دکمه «فعال‌سازی»                                                                                                                                                                                                              |
| `/payment/result`                                 | نتیجه پرداخت با شماره پیگیری (RefID)                                                                                                                                                                                                                                                                                             |
| `/how-it-works`, `/pricing`, `/terms`, `/privacy` | صفحات ایستا                                                                                                                                                                                                                                                                                                                      |
| `/api/og/[slug]`                                  | تولید OG Image داینامیک فارسی برای اشتراک‌گذاری لینکدین                                                                                                                                                                                                                                                                          |

سایر الزامات فرانت:

- `<html lang="fa" dir="rtl">`، تمام آیکون‌های جهت‌دار در RTL آینه شوند.
- همه‌ی اعداد نمایشی با ارقام فارسی و جداکننده هزارگان (`۱٬۲۵۰٬۰۰۰ تومان`).
- حالت Loading (Skeleton)، Empty State با تصویر و متن راهنما، و Error State برای همه‌ی لیست‌ها الزامی است.
- دسترس‌پذیری: focus ring واضح، aria-label فارسی، کنتراست حداقل AA، ناوبری کامل با کیبورد.
- PWA پایه: manifest، آیکون‌ها، theme-color.
- SEO: metadata فارسی، sitemap، robots، JSON-LD برای صفحه درخواست.

---

## ۷. سیستم طراحی (packages/ui)

```
--brand-900: #2E2547   --brand-700: #4B3F72   --brand-500: #6B5CA5
--brand-100: #EDE9F7   --accent-urgent: #E8792B   --accent-verified: #2FA36B
--bg: #FFFFFF          --bg-soft: #F7F5F2        --border: #E7E3DD
--text: #1C1A22        --text-muted: #6E6A78
radius: 12px (card) / 10px (input) / 999px (badge)
shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(46,37,71,.06)
spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48
font: Vazirmatn — 400 / 500 / 700
```

سبک بصری: Flat UI مدرن، تمیز و آرام (مرجع حسی: Linear، Notion، Stripe Dashboard). بدون گرادیان سنگین، بدون سایه‌ی اغراق‌شده، بدون افکت سه‌بعدی.

کامپوننت‌های لازم: `Button` (primary/secondary/ghost/danger + loading)، `Input`، `PhoneInput`، `OtpInput`، `Textarea`، `Select`، `Chip/FilterChip`، `Badge` (urgent/featured/verified/time)، `Card`، `RequestCard`، `OfferCard`، `Avatar`، `Tabs`، `Stepper`، `Modal`، `BottomSheet`، `Toast`، `Skeleton`، `EmptyState`، `LockedField`، `JalaliDateTimePicker`، `PriceInput`، `RatingStars`، `ChatBubble`، `BottomNav`.

---

## ۸. سرویس‌های خارجی — همه با الگوی Adapter

هر سه سرویس زیر را **پشت یک اینترفیس** پیاده کن و با متغیر محیطی بین پیاده‌سازی واقعی و Mock سوییچ کن. در حالت لوکال پیش‌فرض روی Mock باشد تا توسعه بدون کلید API ممکن باشد.

### ۸.۱ پیامک — sms.ir

```ts
interface SmsProvider {
  sendVerification(phone: string, code: string): Promise<SmsResult>;
  sendNotification(
    phone: string,
    templateId: number,
    params: Record<string, string>,
  ): Promise<SmsResult>;
}
```

- پیاده‌سازی `SmsIrProvider`: درخواست POST به endpoint ارسال کد تأیید سرویس sms.ir با هدر `x-api-key`، بدنه شامل `mobile`، `templateId` و آرایه‌ی `parameters`.
- پیاده‌سازی `MockSmsProvider`: کد را در لاگ سرور با فرمت واضح چاپ کند و در حالت dev در پاسخ API هم برگرداند (فقط اگر `NODE_ENV=development`).
- **مهم:** مستندات دقیق و نسخه‌ی فعلی API را از پنل sms.ir تأیید کن؛ اگر ساختار متفاوت بود، فقط داخل Adapter تغییر بده و بقیه‌ی کد را دست نزن. تمام پاسخ‌ها و خطاها لاگ ساختاریافته شوند (بدون لاگ کردن کد OTP در production).
- Retry با backoff نمایی (۳ تلاش) داخل صف BullMQ.

### ۸.۲ پرداخت — زرین‌پال

```ts
interface PaymentProvider {
  createPayment(input: {
    amountRial: number;
    description: string;
    callbackUrl: string;
    mobile?: string;
  }): Promise<{ authority: string; redirectUrl: string }>;
  verifyPayment(input: {
    authority: string;
    amountRial: number;
  }): Promise<{ ok: boolean; refId?: string; cardPan?: string; raw: unknown }>;
}
```

- `ZarinpalProvider`: مرحله‌ی request برای دریافت `authority`، ریدایرکت کاربر به صفحه‌ی StartPay، سپس callback و **verify اجباری سمت سرور**.
- پشتیبانی از حالت **Sandbox** با یک متغیر محیطی جداگانه.
- تبدیل تومان به ریال (× ۱۰) فقط در همین Adapter.
- **Idempotency**: هر `authority` فقط یک بار قابل verify باشد؛ verify تکراری نباید Entitlement دوباره بسازد. از قید یکتا روی `authority` و تراکنش دیتابیس استفاده کن.
- در صورت `PAID` بودن قبلی، کاربر را با پیام مناسب به صفحه نتیجه هدایت کن.
- `MockPaymentProvider`: یک صفحه‌ی شبیه‌ساز لوکال با دو دکمه «پرداخت موفق» و «پرداخت ناموفق».

### ۸.۳ هوش مصنوعی

```ts
interface AiProvider {
  clarify(
    userText: string,
    history: Msg[],
  ): Promise<{ questions: Question[]; draft: RequestDraft }>;
}
```

- خروجی **کاملاً ساختاریافته و اعتبارسنجی‌شده با zod** (`title`, `description`, `category`, `skills`, `durationMinutes`, `mode`, `suggestedBudgetRange`, `clarifyingQuestions`).
- پرامپت سیستمی فارسی که مدل را ملزم می‌کند حداکثر ۳ سؤال کوتاه و مفید بپرسد و لحن محترمانه و ساده داشته باشد.
- `MockAiProvider` قاعده‌محور برای توسعه‌ی آفلاین.
- محدودیت نرخ: حداکثر ۱۰ فراخوانی AI در ساعت برای هر کاربر.

---

## ۹. امنیت (چک‌لیست اجباری)

- شماره موبایل کاربران هرگز در پاسخ‌های عمومی API قرار نگیرد.
- بودجه در سطح سرور Mask شود (بند ۴.۲).
- Ownership Guard برای هر عملیات روی `Request`، `Offer` و `Conversation`.
- Rate limiting جداگانه برای OTP، ارسال پیشنهاد، ارسال پیام و فراخوانی AI.
- Sanitize کردن ورودی‌های متنی (جلوگیری از XSS در توضیحات و پیام‌ها).
- کوکی‌های `httpOnly`, `secure` در production, `sameSite=lax` + محافظت CSRF برای متدهای تغییردهنده.
- هیچ کلید یا سکرتی داخل کد یا کامیت نباشد. فقط `.env.example` کامیت شود.
- لاگ ساختاریافته با pino و پنهان‌سازی خودکار فیلدهای حساس (`phone`, `code`, `token`, `authority`).

---

## ۱۰. محیط لوکال

```bash
docker compose up -d          # postgres:16 (5432) + redis:7 (6379)
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev                      # web:3000  |  api:3001  |  docs:3001/docs
```

فایل `.env.example` با کامنت فارسی برای هر متغیر:

```
NODE_ENV=development
DATABASE_URL=postgresql://vaqt:vaqt@localhost:5432/vaqt
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET= / JWT_REFRESH_SECRET=
WEB_ORIGIN=http://localhost:3000
API_URL=http://localhost:3001

SMS_PROVIDER=mock            # mock | smsir
SMSIR_API_KEY=
SMSIR_VERIFY_TEMPLATE_ID=

PAYMENT_PROVIDER=mock        # mock | zarinpal
ZARINPAL_MERCHANT_ID=
ZARINPAL_SANDBOX=true
ZARINPAL_CALLBACK_URL=http://localhost:3001/payments/zarinpal/callback

AI_PROVIDER=mock             # mock | openai | anthropic
AI_API_KEY=
```

**Seed داده‌ی واقع‌گرایانه فارسی:** ۸ کاربر (۴ درخواست‌کننده، ۴ ارائه‌دهنده با پروفایل کامل و امتیاز)، ۱۲ دسته‌بندی، ۱۵ درخواست در وضعیت‌های مختلف (شامل یک «فوری» و یک «ارتقایافته»)، ۲۰ پیشنهاد، ۲ گفتگوی فعال با پیام، ۵ محصول ارتقا با قیمت‌های واقعی تومانی. عنوان‌های واقعی مثل «بازبینی روش‌شناسی پایان‌نامه علوم اجتماعی»، «تصحیح رزومه برای موقعیت دکترا»، «مشاوره کدنویسی پایتون»، «تمرین مصاحبه شغلی».

---

## ۱۱. فازبندی اجرا (این ترتیب را رعایت کن)

پس از پایان **هر فاز**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` اجرا شود، یک کامیت با فرمت Conventional Commits ثبت شود، `CLAUDE.md` به‌روز شود، و **یک خلاصه‌ی کوتاه به من گزارش بده و منتظر تأیید بمان.**

- **فاز ۰ — پایه:** monorepo، turborepo، تنظیمات TS/ESLint/Prettier/Husky، docker-compose، `.env.example`، `README.md` فارسی، `CLAUDE.md`.
- **فاز ۱ — دیتابیس:** Prisma schema کامل + migration اول + seed.
- **فاز ۲ — احراز هویت:** ماژول auth، OTP، JWT، کوکی، rate limit، Mock SMS، تست e2e.
- **فاز ۳ — سیستم طراحی:** Tailwind config با توکن‌ها، فونت Vazirmatn، `packages/ui` با تمام کامپوننت‌ها + یک صفحه‌ی `/dev/ui` برای مشاهده‌ی همه‌ی کامپوننت‌ها.
- **فاز ۴ — درخواست‌ها:** CRUD، انتشار، فهرست با فیلتر و صفحه‌بندی، Masking بودجه، صفحات `/opportunities` و `/r/[slug]`.
- **فاز ۵ — AI:** ماژول ai + ویزارد `/requests/new` با Live Preview.
- **فاز ۶ — پیشنهادها:** ارسال، حریم خصوصی، داشبورد، انتخاب پیشنهاد + ساخت گفتگو + پیام سیستمی.
- **فاز ۷ — چت:** Socket.IO، لیست گفتگوها، صفحه چت، خوانده‌شدن، اعلان‌ها.
- **فاز ۸ — پرداخت:** محصولات، سفارش، زرین‌پال (Mock + Real)، Entitlement، Job نردبان، صفحه `/profile/upgrades` و `/payment/result`.
- **فاز ۹ — تکمیل تجربه:** نظرات و امتیاز، پروفایل عمومی، OG Image لینکدین، PWA، SEO، Empty/Error States، بهینه‌سازی موبایل.
- **فاز ۱۰ — کیفیت و تحویل:** تست‌های Playwright برای مسیر کامل کاربر، بازبینی امنیتی طبق بند ۹، بهینه‌سازی Lighthouse (هدف: Performance و Accessibility بالای ۹۰ در موبایل)، مستندسازی نهایی، آماده‌سازی Dockerfile برای production.

---

## ۱۲. Git و انتشار

- در فاز ۰: `git init`، شاخه‌ی اصلی `main`، `.gitignore` کامل (شامل `.env`, `node_modules`, `.next`, `dist`, `coverage`).
- کامیت‌های کوچک و معنادار با Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- **تا زمانی که من صریحاً نگفتم، هیچ چیزی را push نکن.** فقط لوکال کار کن.
- وقتی گفتم آماده است، این مراحل را انجام بده و دستورها را برایم نمایش بده:

```bash
git remote add origin https://github.com/arazshah/vaqt.me.git
git branch -M main
git push -u origin main
```

- قبل از اولین push، اجرای `git log -p | grep -iE "api[_-]?key|secret|merchant"` برای اطمینان از لو نرفتن سکرت‌ها الزامی است.
- در README یک بخش «راه‌اندازی سریع» و یک بخش «متغیرهای محیطی» بنویس.

---

## ۱۳. قواعد کار تو (Claude Code)

1. اگر جایی از این سند مبهم بود یا تصمیم معماری مهمی لازم شد، **قبل از پیاده‌سازی بپرس** — حدس نزن.
2. هیچ فایلی را بدون دلیل بازنویسی نکن؛ تغییرات را حداقلی و هدفمند نگه دار.
3. هرگز `.env` واقعی نساز و هیچ سکرتی را کامیت نکن.
4. هیچ دستور مخربی (drop database، reset migration، حذف پوشه) را بدون تأیید من اجرا نکن.
5. برای هر ماژول backend، تست بنویس. کد بدون تست تحویل نده.
6. تمام متن‌های رو به کاربر فارسی، محترمانه و بدون اصطلاح فنی نامفهوم باشند. متن‌ها را در یک فایل مرکزی `messages/fa.ts` نگه دار.
7. در پایان هر فاز، خروجی و نحوه‌ی تست دستی آن را در چند خط به من توضیح بده.
8. کیفیت بصری اولویت بالایی دارد: طراحی باید تمیز، حرفه‌ای، آرام و کاملاً قابل استفاده روی موبایل باشد — نه یک نمونه‌ی خام.
