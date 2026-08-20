# CLAUDE.md — تصمیمات نهایی پروژه Vaqt.me

> این فایل شامل تمام تصمیمات نهایی معماری و پیاده‌سازی است. در هر فاز به‌روز می‌شود.

**آخرین به‌روزرسانی:** فاز ۱ — دیتابیس (تکمیل‌شده)
**وضعیت:** فاز ۱ تکمیل — آماده برای فاز ۲

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

### ۱۲. منبع حقیقت enum‌ها (فاز ۱)

- تمام enum‌های سیستم در `packages/shared/src/constants/enums.ts` به‌صورت `as const` + `z.enum` تعریف می‌شوند؛ `prisma/schema.prisma` آینه‌ی همین مقادیر است
- `packages/shared` هیچ وابستگی‌ای به `@prisma/client` ندارد (جهت وابستگی همیشه shared → prisma، نه برعکس)
- تست واحد `packages/db/src/__tests__/enums.test.ts` برابری مقادیر هر enum بین دو طرف را assert می‌کند؛ در صورت drift، تست fail می‌شود (تأیید شد با یک drift موقت عمدی)

### ۱۳. هش OTP (فاز ۱ — جایگزین بند ۷۱ PROJECT_SPEC)

- به‌جای bcrypt، از **HMAC-SHA256 با pepper سمت سرور** استفاده می‌شود
- pepper در env متغیر `OTP_PEPPER` (اضافه‌شده به `apps/api/.env.example`)
- مقایسه‌ی کد وارد‌شده با هش ذخیره‌شده حتماً با `crypto.timingSafeEqual` انجام شود (نه `===`)
- پیاده‌سازی واقعی هش/مقایسه در فاز ۲ (احراز هویت) انجام می‌شود؛ در فاز ۱ فقط فیلد `VerificationCode.codeHash` (String) و env var آماده شدند

### ۱۴. Offer — یکتایی سخت + رفتار re-submit

- قید `@@unique([requestId, providerId])` سخت باقی می‌ماند (هر ارائه‌دهنده فقط یک رکورد Offer به‌ازای هر درخواست)
- ارسال مجدد پیشنهاد پس از `WITHDRAWN`، رکورد یکسان را به‌جای رکورد جدید به `PENDING` برمی‌گرداند و `revisionCount` را یک واحد افزایش می‌دهد (پیاده‌سازی منطق در سرویس فاز ۶؛ فیلد `revisionCount` در فاز ۱ به مدل اضافه شد)

### ۱۵. مهارت‌های درخواست — جدول واسط

- ارتباط Request↔Skill به‌جای `String[]` با جدول واسط `RequestSkill` (کلید ترکیبی `requestId`+`skillId`) پیاده شده تا یکپارچگی ارجاعی و امکان کوئری معکوس (کدام درخواست‌ها فلان مهارت را دارند) حفظ شود

### ۱۶. جست‌وجوی فارسی

- افزونه `pg_trgm` در migration اول فعال شده (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`)
- ستون `Request.searchText` در زمان نوشتن (create/update سرویس) با `normalizeFa(title + ' ' + description)` پر می‌شود — نه به‌صورت generated column در دیتابیس
- ایندکس `GIN` با `gin_trgm_ops` روی `searchText` (اضافه‌شده با SQL خام به migration، نه از طریق attribute بومی Prisma، چون خروجی مستقیم و قابل‌پیش‌بینی‌تر است)
- تابع `normalizeFa()` در `packages/shared/src/utils/normalize-fa.ts`: تبدیل ي/ك عربی به ی/ک، حذف اعراب و تطویل (tatweel)، تبدیل ارقام فارسی/عربی به لاتین، یکسان‌سازی نیم‌فاصله (ZWNJ) به فاصله‌ی معمولی، یکسان‌سازی فاصله‌ها — با ۱۰ تست واحد
- تأیید شد: seed شامل یک درخواست (`req-thesis-literature`) با ي عربی در توضیحات است؛ کوئری trigram با نسخه‌ی نرمال‌شده‌ی همان عبارت با موفقیت آن را پیدا می‌کند

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

## بدهی فنی

| مورد                                           | توضیح                                                                                 | فاز رفع |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- | ------- |
| `--passWithNoTests` در اسکریپت‌های jest اپ api | باید حذف شود تا نبود تست به‌جای سبز شدن مصنوعی، fail واقعی بدهد                       | فاز ۲   |
| نبود `coverageThreshold` در jest اپ api        | باید طبق آستانه‌های بند «استراتژی تست» (۱۰۰٪ برای پنج نقطه حساس، ~۷۰٪ بقیه) اضافه شود | فاز ۲   |

---

## وضعیت فازها

| فاز                | وضعیت        | توضیحات                          |
| ------------------ | ------------ | -------------------------------- |
| ۰ — پایه           | ✅ تکمیل‌شده | Bootstrap monorepo               |
| ۱ — دیتابیس        | ✅ تکمیل‌شده | Prisma + migration + seed        |
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

## یادداشت‌های فاز ۰

- monorepo با pnpm workspaces و turborepo راه‌اندازی و تأیید شد
- تنظیمات پایه برای توسعه (ESLint, Prettier, Husky, Commitlint) فعال و بدون خطا
- زیرساخت dev با Docker Compose (postgres سالم؛ redis روی این ماشین با یک سرویس محلی دیگر روی پورت ۶۳۷۹ تداخل داشت — با تغییر مپ پورت به `6380:6379` و به‌روزرسانی `REDIS_URL` رفع شد)
- `turbo.json`: تسک `typecheck` (و `lint`/`build`) به `^build` وابسته است؛ چون Prisma Client خروجی خودِ پکیج `@vaqt/db` است نه یکی از وابستگی‌هایش، override اختصاصی `@vaqt/db#typecheck` (و `#lint`, `#test`) به `["^build", "build"]` اضافه شد تا `prisma generate` قبل از typecheck خودِ همان پکیج هم اجرا شود. با `git clean -xdf && pnpm install && pnpm typecheck` تأیید شد.
- فایل‌های config محیط توسعه (.nvmrc, .editorconfig, .vscode)
- `pnpm install` + `lint` + `typecheck` + `build` + `test` روی هر ۵ workspace (api, web, db, shared, ui) سبز
- اسکیمای Prisma placeholder با موفقیت migrate و seed شد در دیتابیس واقعی

---

## یادداشت‌های فاز فعلی (فاز ۱)

- منبع حقیقت enum‌ها در `packages/shared/src/constants/enums.ts` (۱۵ enum، هلپر `createEnum` مشترک برای `as const` + `z.enum`)؛ Prisma schema آینه‌ی آن با تست برابری خودکار در `packages/db/src/__tests__/enums.test.ts` (۱۶ تست، شامل تست منفی برای پوشش کامل enum‌ها)
- اسکیمای کامل Prisma: ۱۹ مدل مطابق بند ۳ اسپک (User, VerificationCode, Category, Skill, RequestSkill, Request, AiSession, Offer, Conversation, Message, Review, Product, Order, Entitlement, Subscription, Notification, AuditLog, Report)
- migration اول (`20260820124448_init`) شامل `CREATE EXTENSION IF NOT EXISTS pg_trgm` و ایندکس `GIN … gin_trgm_ops` روی `Request.searchText` (با SQL خام)؛ روی Postgres واقعی اجرا شد
- `packages/db` اکنون به `@vaqt/shared` و `nanoid` وابسته است؛ اسکریپت `build` پکیج db برابر `prisma generate` است تا override اختصاصی turbo (بند بالا) بتواند قبل از typecheck/lint/test خودِ پکیج آن را صدا بزند
- vitest به‌عنوان test runner برای `packages/shared` و `packages/db` اضافه شد (apps/api همچنان jest است؛ تفاوت runner بین workspaceها بلامانع است چون هرکدام مستقل turbo run می‌شوند)
- seed idempotent با id ثابت (upsert): ۸ کاربر (۴ درخواست‌کننده + ۴ ارائه‌دهنده با bio)، ۱۲ دسته (۷ سطح اول + ۵ زیردسته)، ۱۲ مهارت، ۱۵ درخواست (۲ DRAFT، ۷ PUBLISHED شامل یک فوری و یک ارتقایافته، ۲ OFFER_SELECTED، ۱ CLOSED، ۲ EXPIRED، ۱ REMOVED)، ۲۰ پیشنهاد، ۲ گفتگوی فعال با پیام سیستمی + متنی، ۲ نظر، ۵ محصول ارتقا — با دو اجرای متوالی روی دیتابیس واقعی تأیید شد (تعداد ردیف‌ها بدون تغییر)
- درخواست `req-thesis-literature` عمداً حاوی «ي» عربی (نه «ی» فارسی) در توضیحات است؛ کوئری trigram با نسخه‌ی نرمال‌شده همان عبارت آن را با موفقیت پیدا کرد (تأیید شده روی Postgres واقعی، هم با seq scan و هم با اجبار به استفاده از ایندکس GIN)
- `pnpm lint && pnpm typecheck && pnpm build && pnpm test` روی هر ۵ workspace سبز
