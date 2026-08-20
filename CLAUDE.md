# CLAUDE.md — تصمیمات نهایی پروژه Vaqt.me

> این فایل شامل تمام تصمیمات نهایی معماری و پیاده‌سازی است. در هر فاز به‌روز می‌شود.

**آخرین به‌روزرسانی:** فاز ۰ — Bootstrap Monorepo (تکمیل‌شده)
**وضعیت:** فاز ۰ تکمیل — آماده برای فاز ۱

---

## تصمیمات فنی نهایی

### ۱. shadcn/ui و RTL

- **از CLI رسمی shadcn/ui استفاده شود، بدون fork**
- کامپوننت‌ها در `packages/ui` قرار می‌گیرند و همان‌جا RTL می‌شوند
- کل اپ در `<DirectionProvider dir="rtl">` رادیکس پیچیده می‌شود (Radix بومی از `dir` پشتیبانی می‌کند)
- **قاعده مطلق در کل پروژه:** استفاده از یوتیلیتی‌های منطقی Tailwind الزامی است:
  - استفاده کنید: `ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s`, `rounded-s-*`
  - **ممنوع:** `pl`, `pr`, `ml`, `mr`, `left`, `right`
  - این قاعده باید با یک قاعده ESLint یا حداقل یک بخش در این فایل تضمین شود
- آیکون‌های جهت‌دار (فلش‌ها، chevron) با کلاس `rtl:-scale-x-100` آینه می‌شوند

### ۲. فونت Vazirmatn

- نسخه **variable woff2** از ریلیز رسمی مخزن `rastikerdar/vazirmatn` در `apps/web/public/fonts` قرار می‌گیرد
- با `next/font/local` لود می‌شود، `display: swap`، بدون هیچ درخواست به CDN
- **ارقام:** به‌صورت پیش‌فرض ارقام فارسی نمایش داده می‌شوند
- یک هلپر مرکزی `formatNumber` / `formatToman` در `packages/shared` برای استفاده در همه‌جا (نه CSS font-feature)

### ۳. AI Provider

- پیش‌فرض لوکال: `mock`
- پیاده‌سازی واقعی اول: **Anthropic Claude** (مدل قابل تنظیم با env `AI_MODEL`)
- آداپتر به‌گونه‌ای طراحی شود که افزودن OpenAI فقط یک فایل جدید باشد
- **Structured output via tool/function calling** (نه پارس کردن متن آزاد)
- خروجی حتماً با zod اعتبارسنجی شود
- در صورت شکست اعتبارسنجی:
  - یک بار retry با پیام اصلاحی
  - در صورت شکست دوم: fallback به فرم دستی با پیام فارسی محترمانه: «فعلاً نتوانستم درخواست را تحلیل کنم، می‌توانید جزئیات را دستی وارد کنید.»
- پرامپت سیستمی فارسی در فایل جدا نگه داشته می‌شود (`apps/api/src/ai/prompts/clarify.fa.ts`)، نه inline

### ۴. احراز هویت Socket.IO

- **روش اصلی: کوکی**
  - `withCredentials: true` در کلاینت
  - اعتبارسنجی access token از کوکی در handshake
- **روش جایگزین (برای جداسازی دامنه‌ها در آینده):**
  - اندپوینت `POST /auth/ws-ticket` که یک تیکت یک‌بارمصرف با TTL ۶۰ ثانیه در Redis می‌سازد
  - در فاز ۷ فقط مسیر کوکی فعال می‌شود ولی تیکت هم پیاده و تست می‌شود
- در قطع شدن اتصال: reconnect با backoff و رفرش خودکار توکن

### ۵. Cursor Pagination

- مرتب‌سازی چندفیلدی به یک keyset ساده تبدیل می‌شود
- در مدل `Request` دو فیلد اضافه می‌شود:
  - `listTier` (Int) → `2 = featured`, `1 = urgent`, `0 = عادی`
  - `listRankAt` (DateTime) → در `publish` و در هر `bump` به‌روز می‌شود (پیش‌فرض = `publishedAt`)
- مرتب‌سازی همیشه: `ORDER BY listTier DESC, listRankAt DESC, id DESC`
- کرسر = base64 از `{ listTier, listRankAt, id }`
- ایندکس ترکیبی روی همین سه فیلد ساخته می‌شود
- **هر دو فیلد فقط سمت سرور محاسبه و نوشته می‌شوند و در هیچ DTO ورودی قابل ست‌شدن نیستند**

### ۶. فیلتر بودجه

- در نسخه ۱، **هیچ فیلتر یا مرتب‌سازی بر اساس بودجه در فهرست عمومی وجود ندارد** (نشتی اطلاعات)
- فیلترهای مجاز:
  - حوزه/دسته
  - `mode` (آنلاین/حضوری)
  - شهر
  - مدت زمان
  - مهلت (امروز/این هفته)
  - جست‌وجوی متنی
- بازه بودجه فقط در صفحه جزئیات و فقط برای کاربر با `phoneVerifiedAt != null` نمایش داده می‌شود
- برای بقیه: فیلد از پاسخ حذف و `budgetMasked: true` برگردانده می‌شود
- **یک تست خودکار باید تضمین کند که در پاسخ API برای کاربر مهمان و کاربر تأییدنشده، رشته‌ی مبلغ در هیچ بخشی از JSON وجود ندارد**

### ۷. Docker

- فعلاً فقط `docker-compose.yml` برای زیرساخت dev:
  - postgres:16
  - redis:7
  - یک سرویس اختیاری `adminer`
- اپ‌ها روی هاست با `pnpm dev` اجرا می‌شوند
- `Dockerfile` چندمرحله‌ای برای production در فاز ۱۰ ساخته می‌شود — الان نه

### ۸. Commitlint

- `@commitlint/config-conventional`
- Scope های مجاز: `api`, `web`, `ui`, `shared`, `db`, `infra`, `ci`, `docs`
- `subject-case` خاموش
- `header-max-length` = 100
- متن کامیت‌ها انگلیسی

### ۹. صف‌های BullMQ

صف‌های جدا با worker جدا (یک اتصال Redis مشترک):

- **sms** — ارسال OTP و اعلان پیامکی، ۳ retry با backoff نمایی
- **notifications** — اعلان درون‌برنامه‌ای و اعلان هدفمند
- **requests** — نردبان (repeatable) و انقضای خودکار (cron هر ۱۵ دقیقه)
- **payments** — verify تعویقی و آشتی‌سازی سفارش‌های معلق
- **ai** — فراخوانی‌های سنگین AI

همه با `removeOnComplete: {count: 1000}` و `removeOnFail: {count: 5000}`

برای فاز ۰ فقط ساختار و config؛ workerها در فاز مربوطه

### ۱۰. استراتژی تست

- **پوشش ۱۰۰٪ اجباری** (unit + e2e) برای این پنج نقطه:
  1. منطق OTP و rate limit
  2. Masking بودجه
  3. Ownership Guards
  4. جریان انتخاب پیشنهاد (تراکنش)
  5. Idempotency پرداخت
- بقیه‌ی سرویس‌های API: هدف ~۷۰٪
- UI: بدون آستانه coverage. فقط Playwright smoke برای مسیر کامل:
  - ورود → ساخت درخواست → مشاهده در فهرست → ارسال پیشنهاد → انتخاب → چت
- در CI بعداً gate گذاشته می‌شود؛ الان فقط اسکریپت‌ها آماده باشند

### ۱۱. Idempotency کالبک زرین‌پال

بله، کاملاً idempotent:

- قید unique روی `Order.authority`
- کالبک داخل یک تراکنش با `SELECT ... FOR UPDATE` روی سفارش اجرا می‌شود
- اگر وضعیت از قبل `PAID` بود:
  - verify دوباره صدا زده نمی‌شود
  - همان `refId` برگردانده می‌شود
  - Entitlement جدید ساخته نمی‌شود
- کالبک هرگز مستقیم به کاربر HTML نشان نمی‌دهد؛ فقط `302` به `/payment/result?order=...`
- مقایسه‌ی مبلغ برگشتی با مبلغ سفارش الزامی
- در صورت عدم تطابق → `FAILED` + `AuditLog`
- سفارش‌های `PENDING` قدیمی‌تر از ۳۰ دقیقه با job آشتی‌سازی بررسی و بسته می‌شوند

---

## تصمیمات تکمیلی

### محیط و ابزار

- **Node:** 22 LTS
- **pnpm:** 9
- فایل `.nvmrc` و فیلد `packageManager` در `package.json` ست می‌شوند
- منطقه زمانی سراسری: `Asia/Tehran`
- در DB همه‌چیز UTC، تبدیل فقط در لایه نمایش

### مبالغ

- همه مبالغ `Int` بر حسب **تومان**
- تبدیل به ریال فقط داخل آداپتر زرین‌پال (× ۱۰)

### پورت‌ها و API

- web: `3000`
- api: `3001`
- Prefix همه‌ی روت‌های API: `/api/v1`

### متن‌های کاربرپسند

- تمام متن‌های کاربرپسند در:
  - `apps/web/messages/fa.ts`
  - `apps/api/src/common/messages/fa.ts`
- رشته‌ی فارسی hardcode در کامپوننت‌ها **ممنوع**

### محیط محلی

- `.env` واقعی هرگز ساخته یا کامیت نمی‌شود
- فقط `.env.example` کامیت می‌شود

---

## تحویلی‌های فاز ۰

- [x] pnpm workspace + turborepo
- [x] ساختار monorepo (apps/web, apps/api, packages/ui, packages/shared, packages/db)
- [x] تنظیمات TypeScript strict برای همه packages
- [x] ESLint + Prettier + Husky + lint-staged
- [x] Commitlint با conventional config
- [x] docker-compose.yml (postgres + redis + adminer)
- [x] `.nvmrc`
- [x] `.editorconfig`
- [x] `.vscode/settings.json` و `extensions.json`
- [x] `.env.example` برای web و api
- [x] اسکریپت‌های ریشه:
  - `dev`
  - `build`
  - `lint`
  - `typecheck`
  - `test`
  - `format`
  - `db:migrate`
  - `db:seed`
  - `db:studio`
- [x] `README.md` فارسی
- [x] `.gitignore` کامل

---

## قواعد توسعه (Development Rules)

### قواعد Tailwind RTL (الزامی)

**مجاز:**

```tsx
<div className="ps-4 pe-2 ms-auto me-0 start-0 end-4 text-start border-s rounded-s-lg">
```

**ممنوع:**

```tsx
<div className="pl-4 pr-2 ml-auto mr-0 left-0 right-4 text-left border-left rounded-l-lg">
```

این قاعده باید در ESLint یا pre-commit hook بررسی شود.

### کیفیت کد

- تمام کد TypeScript strict mode
- همه سرویس‌های backend باید تست داشته باشند
- کد بدون تست تحویل داده نمی‌شود
- Conventional Commits الزامی

### امنیت

- هیچ سکرتی در کد یا کامیت
- شماره موبایل هرگز در پاسخ‌های عمومی API
- Masking بودجه در سطح سرور
- Ownership Guard برای هر عملیات

---

## وضعیت فازها

| فاز                | وضعیت        | توضیحات                          |
| ------------------ | ------------ | -------------------------------- |
| ۰ — پایه           | ✅ تکمیل‌شده | Bootstrap monorepo               |
| ۱ — دیتابیس        | ⏳ در انتظار | Prisma + migration + seed        |
| ۲ — احراز هویت     | ⏳ در انتظار | OTP + JWT + rate limit           |
| ۳ — سیستم طراحی    | ⏳ در انتظار | Tailwind + Vazirmatn + shadcn/ui |
| ۴ — درخواست‌ها     | ⏳ در انتظار | CRUD + masking + pagination      |
| ۵ — AI             | ⏳ در انتظار | AI wizard + live preview         |
| ۶ — پیشنهادها      | ⏳ در انتظار | Offers + selection flow          |
| ۷ — چت             | ⏳ در انتظار | Socket.IO + conversations        |
| ۸ — پرداخت         | ⏳ در انتظار | Zarinpal + entitlements          |
| ۹ — تکمیل تجربه    | ⏳ در انتظار | Reviews + PWA + SEO              |
| ۱۰ — کیفیت و تحویل | ⏳ در انتظار | E2E tests + security + docker    |

---

## یادداشت‌های فاز فعلی (فاز ۰)

- monorepo با pnpm workspaces و turborepo راه‌اندازی و تأیید شد
- تنظیمات پایه برای توسعه (ESLint, Prettier, Husky, Commitlint) فعال و بدون خطا
- زیرساخت dev با Docker Compose (postgres سالم؛ redis روی این ماشین با یک سرویس محلی دیگر تداخل پورت دارد — نیازمند بررسی جداگانه)
- فایل‌های config محیط توسعه (.nvmrc, .editorconfig, .vscode)
- `pnpm install` + `lint` + `typecheck` + `build` + `test` روی هر ۵ workspace (api, web, db, shared, ui) سبز
- اسکیمای Prisma placeholder با موفقیت migrate و seed شد در دیتابیس واقعی
