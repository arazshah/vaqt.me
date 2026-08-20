# CLAUDE.md — تصمیمات نهایی پروژه Vaqt.me

> این فایل شامل تمام تصمیمات نهایی معماری و پیاده‌سازی است. در هر فاز به‌روز می‌شود.

**آخرین به‌روزرسانی:** فاز ۲ — احراز هویت (تکمیل‌شده)
**وضعیت:** فاز ۲ تکمیل — آماده برای فاز ۳

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
- **session-cleanup** _(اضافه‌شده در فاز ۲ تکمیلی)_ — job روزانه (`0 3 * * *`، `upsertJobScheduler`) که نشست‌های باطل‌شده‌ی قدیمی‌تر از ۹۰ روز یا منقضی‌شده‌ی قدیمی‌تر از ۹۰ روز را حذف می‌کند؛ چون `Session` مستقیماً به احراز هویت مربوط است و منتظر ماندن تا فاز صف‌های عمومی منطقی نبود

همه با `removeOnComplete: {count: 1000}` و `removeOnFail: {count: 5000}` (مگر جایی که به‌صراحت override شده، مثل `session-cleanup` با سقف کوچک‌تر چون تعداد اجراهایش محدود است)

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

### ۱۷. نرمال‌سازی شماره موبایل (فاز ۲)

- تابع `normalizePhone()` در `packages/shared/src/utils/normalize-phone.ts`، دقیقاً به سبک `normalizeFa()` (همان انضباط: هر کاراکتر غیر-ASCII فقط با escape صریح `\uXXXX`، نه glyph کپی‌شده)
- ورودی‌های مجاز: `09xxxxxxxxx`، `9xxxxxxxxx`، `+989xxxxxxxxx`، `00989xxxxxxxxx` — با ارقام فارسی/عربی، فاصله یا خط تیره؛ همه به شکل canonical `+989xxxxxxxxx`
- هر چیز دیگری `null` برمی‌گرداند؛ در DB (`User.phone`) فقط شکل canonical ذخیره و `@unique` می‌شود
- ۱۸ تست واحد (تمام شکل‌های معتبر + رد موارد نامعتبر)

### ۱۸. ذخیره‌سازی و تأیید OTP

- کد در `VerificationCode.codeHash` با HMAC-SHA256 + `OTP_PEPPER` ذخیره می‌شود؛ Postgres هرگز کد خام را نمی‌بیند
- مقایسه با `crypto.timingSafeEqual`؛ وقتی کد فعالی برای شماره وجود ندارد هم یک HMAC روی مقدار dummy محاسبه و مقایسه می‌شود تا زمان پاسخ بین «کد وجود ندارد» و «کد اشتباه است» یکسان بماند (کد OTP هرگز شماره را لو نمی‌دهد)
- Redis فقط برای شمارنده‌های rate limit و یک کش کوتاه‌مدت «کد در انتظار» (`OtpPendingCodeStore`) استفاده می‌شود — نه برای اعتبارسنجی؛ منبع حقیقت تأیید همیشه Postgres + HMAC است
- ارسال مجدد: تا انقضای کد فعلی، همان کد دوباره صف می‌شود و `expiresAt` تمدید نمی‌شود؛ حداکثر ۳ ارسال برای هر کد (`sendCount`، فیلد جدید روی `VerificationCode`). اگر کش Redis کد در انتظار را از دست بدهد (مثلاً ری‌استارت)، یک کد تازه برای همان ردیف صادر می‌شود بدون تمدید `expiresAt`

### ۱۹. Rate limiting چندلایه (Redis sorted-set sliding window)

پنج لایه، همه با آستانه‌ی قابل‌تنظیم از env (پیش‌فرض‌ها در `apps/api/.env.example`):

1. ارسال مجدد OTP برای هر شماره: حداکثر ۱ در ۶۰ ثانیه
2. هر شماره: ۵ در ساعت، ۱۰ در شبانه‌روز
3. هر IP: ۱۵ در ساعت، ۴۰ در شبانه‌روز
4. تأیید: حداکثر ۵ تلاش برای هر کد (سپس کد باطل می‌شود)
5. پس از ۳ کد باطل‌شده‌ی متوالی برای یک شماره: بلاک ۳۰ دقیقه‌ای (کلید جدا در Redis، مستقل از شمارنده‌های بالا)

پیاده‌سازی sliding window با Redis sorted set (`ZADD`/`ZREMRANGEBYSCORE`/`ZCARD`) — هر تلاش (حتی رد‌شده) یک slot اشغال می‌کند تا کوبیدن endpoint نتواند پنجره را دور بزند.

### ۲۰. JWT و مدیریت نشست (Session)

- access token ۱۵ دقیقه، refresh token ۳۰ روز؛ هر دو httpOnly + `SameSite=Lax` + `Secure` فقط در production. مسیر کوکی refresh محدود به `/api/v1/auth`
- payload توکن حداقلی: فقط `sub` (userId) و `sid` (sessionId) — نقش و وضعیت تأیید در توکن نیستند، همیشه از DB خوانده می‌شوند
- مدل `Session` (migration جداگانه در فاز ۲، چون در فاز ۱ ساخته نشده بود): `refreshTokenHash` (SHA-256، `@unique`)، `familyId`، `userAgent`، `ip`، `expiresAt`، `revokedAt`، `replacedById`
- چرخش refresh token: هر `refresh` یک ردیف `Session` جدید می‌سازد و قبلی را `revokedAt` می‌کند (اتمیک، در یک تراکنش). اگر توکنی که از قبل `revokedAt` دارد دوباره ارسال شود → **کل family** (`revokeFamily`) باطل می‌شود و یک `AuditLog` با `severity: high` ثبت می‌شود، حتی برای نشست‌های دیگرِ همان family که خودشان هرگز replay نشده بودند
- تأیید زنده روی سرور واقعی: replay یک refresh token منقضی‌شده، هر دو نشست خانواده (نشست اصلی + نشست جایگزین قانونی) را در Postgres واقعی `revokedAt` کرد؛ درخواست refresh بعدی با همان کوکی «قانونی» هم رد شد

### ۲۱. گاردها

- `JwtAuthGuard`: سراسری (`APP_GUARD`) و fail-closed؛ فقط signature/expiry توکن را چک می‌کند (بدون hit به DB)، باز کردن روت فقط با `@Public()`. توکن از کوکی `access_token` یا هدر `Authorization: Bearer` خوانده می‌شود (کوکی اولویت دارد)
- `RequireVerifiedPhoneGuard`: `phoneVerifiedAt` و `status` را از DB می‌خواند (نه JWT)، با کش ۳۰ ثانیه‌ای در Redis؛ لغو تأیید در DB حداکثر پس از انقضای کش (نه انقضای access token ۱۵ دقیقه‌ای) اعمال می‌شود — تأیید شد با تست مستقیم گارد (کش دستی flush شد، بدون صبر واقعی)
- `RequireOwnershipGuard` + دکوریتور `@RequireOwnership(resolver)`: عمومی و آماده برای فازهای بعد؛ resolver مالک منبع را برمی‌گرداند، `null` → 404، مالک نامطابق → 403 (برای جلوگیری از leak وجود منبع)

### ۲۲. آداپتر پیامک و صف

- اینترفیس `SmsPort` با `sendOtp` / `sendNotification`؛ `MockSmsAdapter` (کد را فقط خارج از production لاگ می‌کند) و `SmsIrAdapter` (API الگو/verify واقعی sms.ir)
- `DEV_FIXED_OTP` برای تست‌های e2e (فقط خارج از production)
- assertion سخت در bootstrap: `SMS_PROVIDER=mock` با `NODE_ENV=production` باعث throw در ساخت provider می‌شود و برنامه بالا نمی‌آید (تأیید شد با اجرای واقعی)
- ارسال از صف BullMQ با نام `sms` عبور می‌کند (۳ retry، backoff نمایی)؛ خطای صف (مثلاً Redis موقتاً در دسترس نیست) لاگ می‌شود ولی هرگز پاسخ HTTP را بلاک نمی‌کند
- **اتصال Redis مشترک BullMQ در `BullRedisModule` (`BullModule.forRootAsync`) در سطح `AppModule` تنظیم شده** — طبق تصمیم فاز ۰ («یک اتصال Redis مشترک»)؛ این یک باگ واقعی بود که موقع اجرای زنده کشف شد (بدون آن BullMQ با خطای «Worker requires a connection» بالا نمی‌آمد چون `BullModule.registerQueue()` به‌تنهایی connection نمی‌سازد)

### ۲۳. لاگ، Audit و خطاها

- شماره‌ها همه‌جا (لاگ‌ها، `AuditLog.meta`) با `maskPhone()` ماسک می‌شوند: `+98912***4567`
- `AuditLog` برای: ورود موفق، شکست تأیید (با/بدون رسیدن به سقف تلاش)، بلاک شدن شماره، تشخیص reuse (severity: high)، logout، logout-all
- کدهای خطای ماشین‌خوان در `apps/api/src/common/errors/error-codes.ts`، پیام فارسی متناظر در `apps/api/src/common/messages/fa.ts` (`OTP_RATE_LIMITED`, `OTP_EXPIRED`, `OTP_INVALID`, `PHONE_BLOCKED`, `PHONE_NOT_VERIFIED`, `SESSION_INVALID`, `SESSION_REUSE_DETECTED`, ...)؛ فرمت پاسخ خطا `{ code, message, details? }` طبق بند ۵ اسپک، پیاده‌سازی با `AllExceptionsFilter` سراسری
- برای rate limit، هدر `Retry-After` هم ارسال می‌شود

### ۲۴. اندپوینت‌ها (تأیید شده با اجرای زنده روی سرور واقعی)

همه با prefix `/api/v1`: `POST /auth/otp/request`، `POST /auth/otp/verify`، `POST /auth/refresh`، `POST /auth/logout`، `POST /auth/logout-all`، `GET /auth/me`، `PATCH /auth/role`، `POST /auth/ws-ticket` (تیکت یک‌بارمصرف، TTL ۶۰ ثانیه در Redis). `GET /health` عمداً `@Public()` است (برای health-check‌های زیرساخت بدون auth) — این هم یک باگ واقعی بود که موقع اجرای زنده کشف و رفع شد.

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

| مورد                                                                         | توضیح                                                                                                                                             | فاز رفع |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| ~~`--passWithNoTests` در اسکریپت‌های jest اپ api~~                           | ✅ رفع شد در فاز ۲ — حذف شد، اکنون نبود تست واقعاً fail می‌دهد                                                                                    | —       |
| ~~نبود `coverageThreshold` در jest اپ api~~                                  | ✅ رفع شد در فاز ۲ — آستانه‌ی global ۷۰٪ + آستانه‌ی ۱۰۰٪ برای otp/rate-limit/session/auth.service/require-verified-phone.guard اضافه شد           | —       |
| `AppService.getHealth()` واقعاً DB/Redis را چک نمی‌کند                       | طبق اسپک («GET /health (db + redis)») باید اتصال واقعی Postgres و Redis را تست کند؛ فعلاً فقط timestamp استاتیک برمی‌گرداند (باقی‌مانده از فاز ۰) | فاز ۳   |
| AuditLog با `actorId: null` (شکست تأیید OTP، بلاک شدن) پاک‌سازی خودکار ندارد | اجراهای مکرر تست‌های rate-limit روی Postgres واقعی این ردیف‌ها را انباشته می‌کنند؛ نیاز به مکانیزم پاک‌سازی یا نگه‌داشتن آن‌ها با TTL/job دوره‌ای | فاز ۱۰  |
| `ts-node --transpile-only` موقتی است                                         | راه‌حل نهایی: بیلد `packages/shared` به `dist` با فیلد `exports` و بازگشت به `nest start --watch`                                                 | فاز ۱۰  |

---

## وضعیت فازها

| فاز                | وضعیت        | توضیحات                          |
| ------------------ | ------------ | -------------------------------- |
| ۰ — پایه           | ✅ تکمیل‌شده | Bootstrap monorepo               |
| ۱ — دیتابیس        | ✅ تکمیل‌شده | Prisma + migration + seed        |
| ۲ — احراز هویت     | ✅ تکمیل‌شده | OTP + JWT + rate limit           |
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
- `turbo.json`: تسک `typecheck` (و `lint`/`build`) به `^build` وابسته است؛ چون Prisma Client خروجی خودِ پکیج `@vaqt/db` است نه یکی از وابستگی‌هایش، override اختصاصی `@vaqt/db#typecheck` (و `#lint`, `#test`) اضافه شد تا `prisma generate` قبل از typecheck خودِ همان پکیج هم اجرا شود. با `git clean -xdf && pnpm install && pnpm typecheck` تأیید شد. **به‌روزرسانی فاز ۲:** این معماری بعداً به `generate` (تسک واقعی و مستقل، نه `build`) منتقل شد — به یادداشت فاز ۲ مراجعه شود.
- فایل‌های config محیط توسعه (.nvmrc, .editorconfig, .vscode)
- `pnpm install` + `lint` + `typecheck` + `build` + `test` روی هر ۵ workspace (api, web, db, shared, ui) سبز
- اسکیمای Prisma placeholder با موفقیت migrate و seed شد در دیتابیس واقعی

---

## یادداشت‌های فاز ۱

- منبع حقیقت enum‌ها در `packages/shared/src/constants/enums.ts` (۱۵ enum، هلپر `createEnum` مشترک برای `as const` + `z.enum`)؛ Prisma schema آینه‌ی آن با تست برابری خودکار در `packages/db/src/__tests__/enums.test.ts` (۱۶ تست، شامل تست منفی برای پوشش کامل enum‌ها)
- اسکیمای کامل Prisma: ۱۸ مدل — ۱۷ مدل اسپک (User, VerificationCode, Category, Skill, Request, AiSession, Offer, Conversation, Message, Review, Product, Order, Entitlement, Subscription, Notification, AuditLog, Report) + یک مدل اضافه (**RequestSkill**، جدول واسط؛ مستندسازی کامل در PROJECT_SPEC.md بند ۳ و `packages/db/README.md`)
- migration اول (`20260820124448_init`) شامل `CREATE EXTENSION IF NOT EXISTS pg_trgm` و ایندکس `GIN … gin_trgm_ops` روی `Request.searchText` (با SQL خام)؛ روی Postgres واقعی اجرا شد
- `packages/db` اکنون به `@vaqt/shared` و `nanoid` وابسته است (این وضعیت بعداً در فاز ۱ تکمیلی به معماری `generate`-محور فعلی منتقل شد — به یادداشت فاز ۱ تکمیلی مراجعه شود)
- vitest به‌عنوان test runner برای `packages/shared` و `packages/db` اضافه شد (apps/api همچنان jest است؛ تفاوت runner بین workspaceها بلامانع است چون هرکدام مستقل turbo run می‌شوند)
- seed idempotent با id ثابت (upsert): ۸ کاربر (۴ درخواست‌کننده + ۴ ارائه‌دهنده با bio)، ۱۲ دسته (۷ سطح اول + ۵ زیردسته)، ۱۲ مهارت، ۱۵ درخواست (۲ DRAFT، ۷ PUBLISHED شامل یک فوری و یک ارتقایافته، ۲ OFFER_SELECTED، ۱ CLOSED، ۲ EXPIRED، ۱ REMOVED)، ۲۰ پیشنهاد، ۲ گفتگوی فعال با پیام سیستمی + متنی، ۲ نظر، ۵ محصول ارتقا — با دو اجرای متوالی روی دیتابیس واقعی تأیید شد (تعداد ردیف‌ها بدون تغییر)
- درخواست `req-thesis-literature` عمداً حاوی «ي» عربی (نه «ی» فارسی) در توضیحات است؛ کوئری trigram با نسخه‌ی نرمال‌شده همان عبارت آن را با موفقیت پیدا کرد (تأیید شده روی Postgres واقعی، هم با seq scan و هم با اجبار به استفاده از ایندکس GIN)
- `pnpm lint && pnpm typecheck && pnpm build && pnpm test` روی هر ۵ workspace سبز

---

## یادداشت‌های فاز فعلی (فاز ۲)

### تصمیمات و پیاده‌سازی

- ماژول کامل `apps/api/src/auth/**` (auth.controller/service، otp، rate-limit، session، sms، audit، guards، decorators) + `apps/api/src/common/**` (errors، filters، messages، redis، decorators) — جزئیات کامل در بندهای ۱۷ تا ۲۴ بالا
- `Session` model با migration جداگانه (`add_session`) و ستون `VerificationCode.sendCount` با migration جداگانه (`add_verification_code_send_count`) — هر دو روی Postgres واقعی اجرا شدند
- تمام آستانه‌های OTP/rate-limit/JWT/session از env با پیش‌فرض مستند خوانده می‌شوند، نه hardcode (`AuthConfigService`)؛ همه‌ی متغیرهای جدید با کامنت فارسی در `apps/api/.env.example` اضافه شدند

### باگ‌های واقعی که در اجرای زنده کشف و رفع شدند

این‌ها فقط با اجرای واقعی سرور کشف شدند، نه با تست واحد یا typecheck:

1. **اتصال BullMQ**: `BullModule.registerQueue()` به‌تنهایی کانکشن Redis نمی‌سازد؛ بدون `BullModule.forRootAsync` سراسری (`BullRedisModule` جدید)، برنامه با خطای «Worker requires a connection» بالا نمی‌آمد. رفع شد با یک ماژول سراسری که کانکشن Redis مشترک را برای همه‌ی صف‌های آینده (طبق تصمیم فاز ۰) فراهم می‌کند.
2. **`GET /health` عمداً باید `@Public()` باشد** — گارد سراسری fail-closed آن را هم می‌بست، که برای health-check‌های زیرساخت (بدون auth) اشتباه است. رفع شد.
3. **اجرای dev واقعاً کار نمی‌کرد**: `packages/shared` و `packages/ui` با `moduleResolution: "bundler"` و بدون build نوشته شده‌اند (مناسب برای Next.js/webpack و ts-jest)، ولی این با اجرای مستقیم توسط Node/`nest start`/esbuild سازگار نیست:
   - `nest start` (که به‌صورت داخلی ts-node را با تنظیمات خودش صدا می‌زند، نه CLI استاندارد) با خطای `ERR_UNSUPPORTED_DIR_IMPORT` روی `export * from './utils'` مواجه می‌شد، چون در حالت type-checked، ts-node تنظیمات `moduleResolution: bundler` پکیج shared را resolve می‌کرد که با `--transpile-only` سازگار نیست.
   - `tsx` (esbuild) این مشکل خاص را حل می‌کرد ولی یک مشکل دیگر ایجاد می‌کرد: esbuild به‌درستی decorator metadata مورد نیاز DI نستجی (`design:paramtypes`) را emit نمی‌کند، پس تمام سرویس‌های constructor-injected (مثل `RedisService`) با `undefined` به جای وابستگی واقعی می‌ساختند.
   - راه‌حل نهایی: اسکریپت `dev` به `ts-node --transpile-only -r tsconfig-paths/register src/main.ts` تغییر کرد (نه `nest start`، نه `tsx`) — چون ts-node واقعاً از کامپایلر TypeScript استفاده می‌کند (metadata درست) و `--transpile-only` چک سازگاری `module`/`moduleResolution` بین پروژه‌های تو در تو را رد می‌کند.
4. **Turbo در `envMode: "strict"` اجرا می‌شود** (پیش‌فرض Turborepo 2.x) — متغیرهای محیطی shell (مثل `DATABASE_URL`, `REDIS_URL`, `OTP_PEPPER`) به‌طور پیش‌فرض به تسک‌های فرزند منتقل **نمی‌شوند**، مگر در `globalPassThroughEnv` (یا `env`) در `turbo.json` صراحتاً لیست شوند. بدون این، `pnpm test`/`pnpm lint` از ریشه (نه از داخل `apps/api`) با خطای «Environment variable not found: DATABASE_URL» شکست می‌خورد حتی وقتی متغیر در شل export شده بود. لیست کامل تمام متغیرهای `.env.example` (api + web) به `globalPassThroughEnv` اضافه شد.
5. **Race condition واقعی در turbo**: تسک سراسری `lint` (و `test`) به `^generate` وابسته نبود؛ وقتی `pnpm lint` از ریشه چند پکیج را همزمان اجرا می‌کرد، `@vaqt/db#lint` (که به `generate` وابسته است) گاهی هم‌زمان با `@vaqt/api:lint` اجرا می‌شد — `prisma generate` وسط نوشتن Client، فایل‌های نوع را موقتاً ناقص می‌کرد و eslint نوع‌آگاه apps/api را با ده‌ها خطای «type cannot be resolved» مواجه می‌کرد که هیچ‌کدام واقعی نبودند. رفع شد با اضافه‌کردن `dependsOn: ["^generate"]` به تسک‌های سراسری `lint` و `test` در `turbo.json`.

### تست

- ۱۶۵ تست (`apps/api`)، پوشش global ۹۹.۶۵٪ statements؛ پوشش ۱۰۰٪ کامل (branches/functions/lines/statements) روی هر پنج ناحیه‌ی حساس الزامی: `auth/otp/**`, `auth/rate-limit/**`, `auth/session/**`, `auth/auth.service.ts`, `auth/guards/require-verified-phone.guard.ts` — با `coverageThreshold` در `package.json` اجباری شد (نه فقط هدف)
- تست‌های OTP/rate-limit/session روی Redis و Postgres **واقعی** اجرا می‌شوند (نه mock)، با namespace/شماره تصادفی و پاک‌سازی کامل در `afterEach`/`afterAll` — الگوی همان روش فاز ۱ (seed/migration روی DB واقعی)
- سناریوهای صریح تأیید شده: انقضای کد، سقف تلاش و باطل‌شدن، هر پنج لایه‌ی rate limit، یکسان بودن پاسخ برای شماره‌ی موجود/ناموجود، ارسال مجدد بدون تمدید TTL، چرخش refresh token، تشخیص استفاده‌ی مجدد و باطل‌شدن کل family، رد دسترسی کاربر تأییدنشده، و اثر فوری لغو تأیید در DB (بدون نیاز به انقضای access token)
- یک کلاس کمکی تست جدید: `fakeConfig()` در `test-support/fake-config.ts` — چون `ConfigService` واقعی نستجی، `process.env` را قبل از آبجکت پاس‌داده‌شده به constructor چک می‌کند؛ استفاده از `new ConfigService({...})` مستقیم در تست باعث نشتی مقادیر env واقعی شل به تست‌ها می‌شد (کشف شد وقتی تست‌ها با env تنظیم‌شده در CI/شل به‌طور نامنتظره fail/pass می‌کردند)

### اجرای کامل زنده (E2E) روی سرور واقعی

با `pnpm run dev` (env واقعی، `SMS_PROVIDER=mock`) روی Postgres/Redis واقعی: `POST /auth/otp/request` → کد در کنسول (`[mock-sms] OTP for +98912***4567: 41045`) → `POST /auth/otp/verify` → کوکی‌های httpOnly صحیح → `GET /auth/me` → `POST /auth/refresh` (چرخش موفق) → replay توکن قدیمی → `SESSION_REUSE_DETECTED` + **هر دو** نشست خانواده (نه فقط نشست replay‌شده) در Postgres واقعی `revokedAt` شدند + `AuditLog` با `severity: high` ثبت شد. همچنین `PATCH /auth/role`، `POST /auth/ws-ticket`، `POST /auth/logout` (پاک‌کردن کوکی + رد دسترسی بعدی) و assertion سخت `NODE_ENV=production` + `SMS_PROVIDER=mock` (شکست فوری bootstrap) به‌صورت زنده تأیید شدند.

- `pnpm lint && pnpm typecheck && pnpm build && pnpm test` روی هر ۵ workspace سبز

### تکمیل فاز ۲ — هفت مورد سخت‌سازی نهایی

1. **rate limiter اتمیک**: منطق sliding window (`ZREMRANGEBYSCORE`+`ZADD`+`ZCARD`+`EXPIRE`+`ZRANGE`) از ۴-۵ round-trip جدا به یک اسکریپت Lua واحد (`redis.defineCommand('slidingWindow', ...)` در `RedisService`) منتقل شد تا کل چرخه در یک `EVAL` اتمیک اجرا شود. تست یکپارچگی جدید: ۱۰ درخواست همزمان (`Promise.all`) با `limit=5` روی Redis واقعی — دقیقاً ۵ تا `allowed: true` گرفتند.
2. **اعتبارسنجی env**: `env-validation.ts` با zod، به‌عنوان اولین statement داخل `bootstrap()` (قبل از `NestFactory.create`) اجرا می‌شود. `OTP_PEPPER`/`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` حداقل ۳۲ کاراکتر؛ در production نباید برابر مقادیر placeholder فایل `.env.example` باشند. در صورت خطا، تمام خطاها یک‌جا چاپ و `process.exit(1)` صدا زده می‌شود.
3. **تست فهرست روت‌ها**: `public-routes.spec.ts` با reflection (بدون بالا آوردن سرور) روی `PATH_METADATA`/`METHOD_METADATA`/`IS_PUBLIC_KEY` هر کنترلر، مجموعه‌ی روت‌های `@Public()` را با یک allowlist صریح مقایسه می‌کند.
4. **BullMQ**: `maxRetriesPerRequest: null` و `removeOnComplete`/`removeOnFail` قبلاً درست بودند (تأیید شد)؛ `app.enableShutdownHooks()` به `main.ts` اضافه شد (لازم برای بسته‌شدن تمیز workerهای `WorkerHost`)؛ یک تست یکپارچگی جدید (`bull-prefix.spec.ts`) ثابت کرد `REDIS_PREFIX` واقعاً روی کلیدهای BullMQ در Redis واقعی اعمال می‌شود.
5. **پاکسازی نشست**: صف/job جدید `session-cleanup` (روزانه، `0 3 * * *`، از طریق `upsertJobScheduler` ایدمپوتنت) — نشست‌های باطل‌شده‌ی قدیمی‌تر از ۹۰ روز (بر اساس `revokedAt`) یا منقضی‌شده‌ی هرگز-باطل‌نشده‌ی قدیمی‌تر از ۹۰ روز (بر اساس `expiresAt`) را حذف می‌کند؛ منطق در `SessionCleanupService.cleanupOldSessions()` جدا از processor نگه داشته شد تا مستقیماً روی Postgres واقعی تست شود.
6. بدهی فنی ثبت شد (جدول بالا).
7. تگ و push — به بخش انتهای فاز مراجعه شود.
