# CLAUDE.md — وقت من (vaqt.me)

> فقط تصمیم‌های معتبر و قواعدی که نباید شکسته شوند. تاریخچه‌ی فازهای قبلی (بازار
> درخواست/پیشنهاد، چت، پرداخت، AI) عمداً حذف شد؛ در تاریخچه‌ی git (تا کامیت
> `6aad4c0`) موجود است.

**آخرین به‌روزرسانی:** ۲۰۲۶-۱۱-۱۹ — سبک‌سازی کامل: کد و جدول‌های بازار حذف شد.

## محصول

کارت ویزیت آنلاین + رزرو وقت برای متخصصان، کاملاً رایگان، سرور ایرانی.
`vaqt.me/<username>`، QR، لینک پیام‌رسان‌ها (بله/ایتا/روبیکا/واتس‌اپ/تلگرام/اینستاگرام/لینکدین/آپارات/وب‌سایت)،
ذخیره‌ی مخاطب (vCard)، رزرو با **تأیید دستی** متخصص، اعلان به متخصص در **ربات بله**،
پیامک برای OTP و رزرو/یادآوری. نام برند: «وقت من».

## ساختار

```
apps/api       NestJS 10 (پیشوند /api/v1)
apps/web       Next.js 15 App Router + Tailwind v4 (RTL)
packages/shared  zod schemas، enumها، توابع خالص (tsup → dist)
packages/db      Prisma + Postgres 16 (tsup → dist)
packages/ui      shadcn/ui (فقط source؛ Next آن را transpile می‌کند)
eslint-rules     قواعد سفارشی ESLint (با تست)
brand            تولید لوگو (build-logo.py)
```

**قاعده‌ی مصرف پکیج‌ها:** هر چیزی که NestJS (ts-node، بدون bundler) import می‌کند باید به
`dist` بیلد شود (`shared`, `db`)؛ چیزی که فقط Next مصرف می‌کند می‌تواند source-only بماند (`ui`).

### ماژول‌های API

`auth` (OTP، JWT، session، rate limit، SMS) · `users` (پروفایل، آواتار) · `cards` (کارت عمومی،
vCard، آمار) · `booking` (اسلات، رزرو، لغو با توکن) · `notifications` (صف BullMQ + یادآوری) ·
`messenger` (ربات بله) · `wallet` (کیف کارت/تبادل) · `settings` (تنظیمات زمان اجرا) ·
`admin` (setup اولین مدیر + تنظیمات) · `storage` (دیسک/S3).

### مدل‌های دیتابیس (۱۷ جدول)

`User` `Session` `VerificationCode` `AuditLog` `Card` `ContactLink` `ServiceType`
`AvailabilityRule` `AvailabilityException` `Booking` `MessengerBinding` `CardEvent`
`SavedCard` `AppSetting` `KvEntry` `RateEvent` `Job`. بدون Redis: کلید/مقدار موقت، rate limit و صف کارها همه روی Postgres هستند. migrationها: `init` + افزایشی. یک migration تمیز `init` (قبل از اولین استقرار یکی شد؛ از این به بعد
migrationها افزایشی‌اند و **هرگز ویرایش نمی‌شوند**).

## قواعد سخت (نقض‌شان باگ امنیتی/محصولی است)

### امنیت و داده

- شماره‌ی موبایل هرگز در پاسخ عمومی نیست. **تنها استثنا:** کارتی که مالکش `showPhone` را روشن کرده
  (پیش‌فرض خاموش)؛ تست روی JSON خام ثابت می‌کند با خاموش بودن هیچ شکلی از شماره نیست.
- کاربر فقط از `toPublicUser()` / `toPrivateUser()` (`auth/user-view.ts`) خارج می‌شود؛ شماره‌ی خام
  حتی برای مالک برنمی‌گردد (`maskedPhone`). قواعد ESLint `no-raw-user-return` و
  `restrict-to-private-user` اجرای آن‌اند. کارت عمومی field-by-field ساخته می‌شود (هرگز spread ردیف User).
- شماره‌ها در لاگ/AuditLog با `maskPhone()` ماسک می‌شوند.
- `IP` و user-agent بازدیدکننده هرگز ذخیره نمی‌شود (آمار فقط شمارنده است).
- مجوز سطح سیستم فقط `SystemRole` (`USER`/`ADMIN`) است، نه چیز دیگری. `RolesGuard` از DB می‌خواند.
- هیچ سکرتی در کد/کامیت. `.env` واقعی هرگز ساخته نمی‌شود، فقط `.env.example`.
- هر `@Body()` باید `ZodValidationPipe` را **روی خود پارامتر** داشته باشد
  (`@Body(new ZodValidationPipe(Dto))`)، نه `@UsePipes` سطح متد — وگرنه pipe روی
  `@CurrentUser()` هم اجرا می‌شود و بی‌صدا داده را خراب می‌کند (باگ P0 واقعی در تاریخچه).
- هر روت جدید `@Public()` باید در allowlist `public-routes.spec.ts` بیاید.
- روت‌های API فقط `@Get`/`@Post` (RPC-style: `POST /x/update`). `GET` فقط برای خواندن عمومی با path param.
- `origin-check` روی همه‌ی متدهای mutating (و `POST` ها)؛ فراخوانی Node-side باید هدر `Origin` بگذارد.

### ورود با ایمیل (پیش‌فرض) و پیامک (خاموش)

- حساب با ایمیل + رمز (`POST /auth/register|login`)؛ رمز با scrypt؛ `users.phone` اختیاری است.
- ضداسپم ثبت‌نام: honeypot، توکن امضاشده‌ی زمان فرم (۳ ثانیه تا ۲ ساعت)، سقف ثبت‌نام per-IP، بلاک‌لیست ایمیل موقت. ورود: سقف per-IP و per-email.
- ایمیل تأیید نمی‌شود (ارائه‌دهنده‌ی ایمیل نداریم)؛ در صورت راه‌اندازی، تأیید ایمیل اضافه شود.
- مسیرهای OTP/پیامک حذف نشده‌اند؛ تا `SMS_LOGIN_ENABLED=true` پاسخ ۵۰۳ `SMS_LOGIN_DISABLED` می‌دهند. حساب‌های فقط‌ایمیل پیامک نمی‌گیرند.
- ایمیل‌های `@qa.vaqt.test` را `cleanup:qa` پاک می‌کند.

### OTP و نشست

- کد OTP با HMAC-SHA256 + `OTP_PEPPER` (نه bcrypt)، مقایسه با `timingSafeEqual`.
- ۵ لایه rate limit با جدول `RateEvent` داخل یک تراکنش با advisory lock (`KvService.slidingWindow`)؛ ۵ تلاش برای هر کد، بلاک ۳۰ دقیقه‌ای پس از ۳ کد باطل.
- access token ۱۵ دقیقه، refresh ۳۰ روز، هر دو httpOnly/SameSite=Lax (Secure در production).
  payload فقط `sub` و `sid`؛ نقش/وضعیت همیشه از DB. چرخش refresh؛ replay ⇒ ابطال کل family + AuditLog سطح high.
- `SMS_PROVIDER=mock` یا `BALE_PROVIDER=mock` با `NODE_ENV=production` ⇒ throw در بوت.

### رزرو

- ایران بدون ساعت تابستانی ⇒ `Asia/Tehran` = UTC+۳:۳۰ ثابت (`shared/src/utils/tehran-time.ts`). در DB همه‌چیز UTC.
- ضدرزرو دوباره: `SELECT … FOR UPDATE` روی ردیف provider داخل تراکنش و بررسی دوباره‌ی اسلات.
- شماره‌ی رزروکننده فقط در `POST /booking/me/list` (متخصص) می‌آید.
- خدمات حذف‌شده `isActive=false` می‌شوند، حذف سخت نه.
- یادآوری idempotent: claim با `updateMany` شرطی روی `reminder24SentAt/reminder1SentAt`.

### UI

- **RTL مطلق:** فقط `ps-* pe-* ms-* me-* start-* end-* text-start border-s rounded-s-*`.
  ممنوع: `pl pr ml mr left right text-left/right` (ESLint اجرا می‌کند). آیکون جهت‌دار: `rtl:-scale-x-100`.
- رشته‌ی فارسی فقط در `apps/web/messages/fa.ts` و `apps/api/src/common/messages/fa.ts`.
- ارقام فارسی با `formatNumber` از `@vaqt/shared` (نه CSS). فونت Vazirmatn self-host (بدون CDN).
- هر مبلغ (اگر روزی برگردد) ریال ذخیره، تومان نمایش.

## تنظیمات زمان اجرا (پنل ادمین، نه env)

`AppSetting` (AES-256-GCM با کلید مشتق از `APP_SECRET`) + `SettingsService`؛ ترتیب «پنل ← env ← پیش‌فرض»،
در production ارائه‌دهنده‌ها پیش‌فرض `disabled`. تنظیمات: sms.ir، الگوهای پیامک، ربات بله
(+ دکمه‌ی اتصال/ثبت وبهوک و پیامک آزمایشی). مقدار محرمانه هرگز به پنل برنمی‌گردد.
**`APP_SECRET` را هرگز عوض نکنید** (تنظیمات رمزشده و OTP/JWT از آن مشتق‌اند).
اولین مدیر: تا ADMIN نباشد، هر بوت یک توکن یک‌بارمصرف در لاگ api چاپ می‌شود → `/admin/setup`.
تا پیامک راه نیفتاده `POST /auth/otp/request` ⇒ ۵۰۳ `SMS_NOT_CONFIGURED`.

## اعلان‌ها

صف کار Postgres (`JobsService`، `FOR UPDATE SKIP LOCKED`، ۳ retry نمایی) + scan یادآوری هر ۵ دقیقه (تایمر داخل پروسه، idempotent). متخصص ← ربات بله (دکمه‌های
تأیید/رد)، اگر وصل نیست پیامک (سقف ۱۰ در روز)؛ رزروکننده ← پیامک. وبهوک بله با رمز داخل مسیر
(`/messenger/bale/webhook/:secret`)، همیشه ۲۰۰ (هرگز throw). `BaleAdapter` و `SmsIrAdapter` هرگز با
توکن/الگوی واقعی تست نشده‌اند — پیش از production یک‌بار زنده بررسی شوند.

## استقرار (Coolify)

`docker-compose.coolify.yml` + `docs/DEPLOY-COOLIFY.md`. فقط به سرویس `web` دامنه داده می‌شود؛
`web` مسیرهای `/api`، `/uploads` را با `rewrites` به `api` می‌برد (بدون CORS، کوکی first-party).
مهاجرت‌ها موقع بالا آمدن api (`docker-entrypoint.sh`). `trust proxy = 1` فقط در production.
تأییدنشده: اجرا روی خود Coolify، sms.ir/بله واقعی، mirror لازم برای سرور ایرانی.

## توسعه

- Node 22، pnpm 9. `docker compose up -d` (Postgres 16)، `pnpm dev`. web:3000، api:3001.
- دروازه‌ها: `pnpm lint && pnpm typecheck && pnpm build && pnpm test` + `pnpm --filter @vaqt/web test:e2e`
  (مسیر طلایی: کارت ← رزرو ← تأیید دستی). تست‌های API روی Postgres **واقعی** (نه mock).
- `pnpm --filter @vaqt/api cleanup:qa` داده‌ی QA (شماره‌ی `+9899…`) را از dev پاک می‌کند.
- **Conventional Commits** انگلیسی؛ scopeها: `api web ui shared db infra ci docs`؛ سقف header ۱۰۰ کاراکتر.
- migration: همیشه افزایشی؛ `prisma migrate dev --name <x>`.
- تست جدید برای هر سرویس backend؛ ناحیه‌های حساس ۱۰۰٪ پوشش (otp، rate-limit، session، auth.service، گاردها).

### نکته‌های ابزار

- `pkill -f "nest start"` پروسه‌ی `dist/main` را نمی‌کشد؛ با PID بکشید.
- در sandbox: Docker Hub ۴۲۹ می‌دهد (از `mirror.gcr.io` pull کنید) و build باید با CA پراکسی
  (`/root/.ccr/ca-bundle.crt`) انجام شود — هرگز TLS را غیرفعال نکنید.
- `NODE_ENV=development` در شل `next build` را خراب می‌کند؛ build را بدون آن (یا `production`) اجرا کنید.
- Chromium از پیش نصب است: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-*/chrome-linux64/chrome`.
- حالت تست: state صف/rate-limit در Postgres می‌ماند؛ تست‌ها باید شناسه‌ی یکتا (شماره/IP تصادفی) بسازند، نه مقدار ثابت.
- turbo در `envMode: strict` است؛ هر env جدید باید در `globalPassThroughEnv` بیاید.

## فرآیند git

- کار روی برنچ جدا؛ PR فقط وقتی کاربر بخواهد. merge فقط با CI سبز و دستور/مجوز کاربر (قاعده‌ی «CI سبز شرط لازم است، مجوز نیست»).
- هرگز push مستقیم به `main`، force-push، یا دور زدن branch protection.
- تگ‌های فاز annotated (`git tag -a`).

## بدهی/کار باز

- حذف جدول‌های پرداخت انجام شد (با squash migration). مشکل باز: NestJS 10 → 11 (`@nestjs/core` آسیب‌پذیری moderate، PR جدا).
- ایمیج api ~۱٫۹GB (کل workspace + prisma CLI)؛ بهینه‌سازی با `pnpm deploy` یا trace دستی.
- ظاهر سایت: بعد از بالا آمدن سایت با کاربر بحث می‌شود.
- NFC/PDF سمت سرور ساخته نشده (چاپ از مرورگر)؛ فهرست انتظار و «نیامد» ساخته نشده؛ فقط منطقه‌ی زمانی تهران.
