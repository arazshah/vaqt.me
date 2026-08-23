## یادداشت‌های فاز فعلی (فاز ۳)

### تصمیمات و پیاده‌سازی

- ماژول‌های کامل `apps/api/src/users/**`، `categories/**`، `skills/**`، `admin/**`، `storage/**` + گارد/دکوریتور جدید `common/guards/roles.guard.ts`، `common/decorators/roles.decorator.ts`، میدل‌ور `common/middleware/origin-check.middleware.ts` — جزئیات کامل در بندهای ۲۵ تا ۳۰ بالا
- migration جداگانه (`20260820154005_user_profile_fields_and_skills`) روی Postgres واقعی اجرا شد: enum `SystemRole`، فیلدهای جدید `User` (headline, city, modePreference, linkedinUrl, timezone, ratingAvg, ratingCount, systemRole, avatarThumbnailUrl, avatarStorageKey)، مدل جدید `UserSkill`، `isActive` روی `Category`/`Skill`
- SQL تولیدشده توسط Prisma عمداً پیش از اجرا دستی ویرایش شد: چون ایندکس GIN تریگرام فاز ۱ (`requests_searchText_trgm_idx`) با SQL خام ساخته شده بود، Prisma آن را در نمایش داخلی خودش نمی‌شناخت و `DROP INDEX` برایش پیشنهاد داده بود؛ آن خط حذف و با کامنت توضیحی جایگزین شد — با `\d requests` روی DB واقعی تأیید شد که ایندکس باقی ماند (همان الگوی فاز ۱، اکنون به‌عنوان یک قاعده‌ی تکرارشونده برای هر migration آینده‌ای که جدول `requests` را لمس کند مستند شد)

### باگ‌های واقعی که فقط با اجرای زنده کشف شدند (نه با تست واحد یا typecheck)

1. **`file-type` (نسخه‌ی نصب‌شده ۱۹.۶.۰) یک پکیج ESM-only است** — `require()` مستقیم آن از یک فایل CommonJS (مسیر ts-jest/ts-node این پروژه) با `Cannot find module 'file-type'` شکست می‌خورد؛ typecheck آن را نمی‌گرفت چون تایپ‌ها مستقل از resolve زمان اجرا هستند. به‌جای پایین‌آوردن نسخه یا دست‌وپنجه نرم‌کردن با تنظیمات ESM/CJS جدید turbo/jest (که خودش دسته‌ای از مشکلات مشابه فاز ۲ را دوباره باز می‌کرد)، تشخیص magic-byte برای سه فرمت مجاز (jpeg/png/webp) مستقیم و بدون وابستگی در `users/image-magic-bytes.ts` نوشته شد — کوچک‌تر، بدون هیچ ریسک ESM، و دقیقاً همان سه امضای بایت استانداردی که `file-type` هم چک می‌کند.
2. **`AdminModule` نمی‌توانست `RolesGuard` را resolve کند**: `@Roles(SystemRole.ADMIN)` به `AuthConfigService` (پارامتر سوم `RolesGuard`) نیاز دارد؛ `AuthConfigService` از `AuthModule` export می‌شود ولی `AdminModule` آن را import نکرده بود. تست‌های واحد (`roles.guard.spec.ts`, `admin.controller.spec.ts`) این را نمی‌گرفتند چون گاردها را مستقیم `new` می‌کنند، نه از طریق DI container نستجی. فقط بالا آوردن واقعی سرور خطای resolve را نشان داد. رفع شد با افزودن `AuthModule` به `imports` در `admin.module.ts`.
3. **`LocalDiskAdapter.save()` امضای `StoragePort` را کامل پیاده نمی‌کرد**: اینترفیس `save(key, buffer, contentType)` سه پارامتری است (چون `S3Adapter` به `contentType` برای `ContentType` هدر نیاز دارد) ولی `LocalDiskAdapter.save()` فقط دو پارامتر داشت — یک خطای واقعی کامپایل TypeScript که پیش از اجرای زنده هم با `pnpm typecheck` گرفته شد؛ اینجا آورده شده چون در حین آماده‌سازی برای اجرای زنده کشف شد. رفع شد با اضافه‌کردن پارامتر سوم (نادیده‌گرفته‌شده با `_contentType`).

### تست

- ۲۵۳ تست (`apps/api`، ۳۹ suite)، پوشش global: ۹۲٫۶۱٪ statements / ۸۹٫۰۳٪ branches / ۸۷٫۹۷٪ functions / ۹۳٫۱۹٪ lines. پوشش ۱۰۰٪ کامل روی `auth/user-view.ts` و `common/guards/roles.guard.ts` (دو ناحیه‌ی حساس جدید این فاز) با `coverageThreshold` در `package.json` اجباری شد، علاوه بر پنج ناحیه‌ی حساس فاز ۲ که همچنان ۱۰۰٪ ماندند
- تست‌های `UsersService`, `CategoriesService`, `SkillsService`, `AvatarService` روی Postgres/Redis **واقعی** اجرا می‌شوند (نه mock)، با همان الگوی namespace/شماره تصادفی و پاک‌سازی در `afterEach`/`afterAll`
- ماتریس صریح authorization: مالک/کاربر دیگر/ادمین همگی همان شکل عمومی و بدون‌نشتی را از `GET /users/:id` می‌گیرند (تست شده که سه پاسخ دقیقاً برابرند)؛ نقش `ADMIN`/`USER` روی `AdminController` با تست metadata (`@Roles`) + `roles.guard.spec.ts` (که خودش ماتریس کامل allow/deny/no-auth/status-gate/cache-hit/cache-invalidation را پوشش می‌دهد)
- اثبات EXIF/GPS: یک fixture واقعی با `sharp(...).withExif({IFD3: {GPSLatitude...}})` ساخته می‌شود؛ یک TIFF/IFD0-walker کوچک (فقط برای تست) تگ 0x8825 (GPS IFD pointer) را در ورودی پیدا می‌کند تا اثبات کند fixture واقعاً GPS دارد، سپس خروجی سرویس با `sharp(...).metadata().exif` بررسی می‌شود که کاملاً `undefined` است
- اثبات رد فایل تقلبی: بافر متنی معمولی (نه بایت‌های واقعی تصویر) رد می‌شود، حتی بدون اتکا به نام فایل یا Content-Type
- اثبات کش‌شدن `categories`/`skills` در Redis با ETag پایدار بین دو فراخوانی، و invalidation بعد از `create`/`update`
- اثبات مسدودشدن deactivate یک دسته با درخواست فعال (`PUBLISHED`/`DRAFT`/`OFFER_SELECTED`) و مجازبودن آن با درخواست ترمینال (`CLOSED`) — روی Postgres واقعی
- `packages/shared`: توابع `completeness` (۱۱ تست) و `pagination` (۵ تست) با vitest — بدون آستانه‌ی coverage اجباری (به بدهی فنی مراجعه شود)

### اجرای کامل زنده (E2E) روی سرور واقعی

با `pnpm dev` (env واقعی inline، بدون `.env` کامیت‌شده، `SMS_PROVIDER=mock`, `STORAGE_PROVIDER=local`) روی Postgres/Redis واقعی:

1. **کشف باگ DI بالا** (`AdminModule` → `AuthModule`) فقط در همین مرحله، قبل از هر درخواست HTTP.
2. کاربر A: `POST /auth/otp/request` (+9899011122**33**) → `[mock-sms] OTP ...: 55751` در کنسول → `POST /auth/otp/verify` → کوکی‌های httpOnly صحیح؛ پاسخ verify خودش هم عاری از شماره بود.
3. یک تصویر ۸۰۰×۶۰۰ با `sharp` ساخته شد که `IFD3` واقعی (`GPSLatitudeRef/GPSLatitude/GPSLongitudeRef/GPSLongitude`) دارد؛ `sharp(...).metadata().exif` روی این فایل ۳۳۰ بایت EXIF واقعی نشان داد.
4. `POST /users/me/avatar` (multipart) با این فایل → پاسخ `{avatarUrl, avatarThumbnailUrl}` روی `http://localhost:3001/uploads/avatars/<uuid>.jpg` و `<uuid>-thumb.jpg`.
5. هر دو فایل خروجی واقعی از دیسک (سرو شده از همان مسیر استاتیک) با `sharp(...).metadata()` بررسی شدند: اندازه‌ی اصلی دقیقاً ۴۰۰×۴۰۰، thumbnail دقیقاً ۹۶×۹۶، و `exif`/`icc`/`iptc`/`xmp` هر چهار روی هر دو فایل کاملاً `false` (نبود) — اثبات کامل حذف EXIF/GPS روی خروجی واقعی سرور، نه فقط تست واحد.
6. کاربر B (شماره‌ی دیگر) لاگین شد و `GET /users/{id-of-A}` را زد؛ بدنه‌ی کامل پاسخ گرفته و با `grep` برای رشته‌ی شماره‌ی کاربر A (هم فرمت محلی و هم +98) جست‌وجو شد — **هیچ نتیجه‌ای پیدا نشد**، یعنی شماره در هیچ بخشی از JSON خروجی وجود نداشت.
7. پاک‌سازی: هر دو کاربر تست (و session/verification-code/audit-log مرتبط) از Postgres واقعی حذف شدند، پوشه‌ی `apps/api/uploads/` (فایل‌های آواتار آپلودشده) پاک شد، سرور متوقف شد. شمارش نهایی seed فاز ۱ روی DB واقعی تأیید شد بدون تغییر باقی ماند: ۸ کاربر، ۱۵ درخواست، ۱۲ دسته، ۱۲ مهارت.

### تصمیمات فراتر از اسپک اولیه (judgment calls)

- عدم استفاده از `file-type` و نوشتن magic-byte detector اختصاصی (به باگ‌های واقعی بالا مراجعه شود) — یک وابستگی کمتر، بدون ریسک ESM.
- نبود آستانه‌ی coverage اجباری روی `packages/shared` صراحتاً به‌عنوان بدهی فنی ثبت شد به‌جای نادیده‌گرفتن سکوت‌آمیز.
- شماره‌گذاری فاز «سیستم طراحی» یک واحد به عقب رانده شد تا فاز ۳ واقعی (پروفایل کاربر) با آنچه ساخته شد مطابق باشد — به یادداشت بالای جدول «وضعیت فازها» مراجعه شود.
- **بازبینی نهایی (parent session، قبل از push):** دو شکاف واقعی نسبت به اسپک صریح فاز ۳ پیدا و رفع شد: (۱) میدل‌ور `origin-check` بدون تست بود — ۱۳ تست اضافه شد؛ (۲) الزام «یک قاعده‌ی ESLint یا تست که serialize مستقیم موجودیت User در کنترلرها را ممنوع کند» اصلاً پیاده‌سازی نشده بود — قاعده‌ی ESLint سفارشی `local/no-raw-user-return` نوشته و به‌صورت دستی (هم حالت مستقیم و هم حالت wrapper) تأیید شد. هر دو مورد در همان کامیت Batch ۲ ادغام شدند (هیچ‌چیز هنوز push نشده بود).

- `pnpm lint && pnpm typecheck && pnpm build && pnpm test` روی هر ۵ workspace سبز.

### تکمیل نهایی فاز ۳ (بسته‌ی کاری بعدی، پیش از merge)

- **جداسازی `toPublicUser`/`toPrivateUser`:** `toPublicUser()` بدون تغییر باقی ماند (فقط `GET /users/:id`). `toPrivateUser()` جدید اضافه شد (`apps/api/src/auth/user-view.ts`) — فقط برای `GET /users/me` و `GET /auth/me` — که `maskedPhone`/`status`/`systemRole`/`completeness` را روی `PublicUser` اضافه می‌کند؛ شماره‌ی خام تلفن هرگز حتی برای صاحب حساب هم برنمی‌گردد. قاعده‌ی ESLint دوم `local/restrict-to-private-user` نوشته شد که فراخوانی `toPrivateUser()` را فقط به `users.service.ts` و `auth.service.ts` محدود می‌کند؛ با یک فایل موقت واقعاً تأیید شد که هم این قاعده و هم `no-raw-user-return` روی شکل `PrivateUser` درست عمل می‌کنند (بدون false-positive، چون `PrivateUser` هرگز `phone`/`phoneVerifiedAt` خام ندارد).
- **CI:** `.github/workflows/ci.yml` نوشته شد — Postgres 16 + Redis 7 به‌عنوان service container، `prisma migrate deploy`، سپس lint/typecheck/build/test روی هر ۵ workspace، با کش pnpm + Turborepo محلی.
- **تست دائمی قواعد ESLint:** `@typescript-eslint/rule-tester` اضافه شد؛ پروژه‌ی fixture مستقل (`eslint-rules/__fixtures__/tsconfig.json`) برای قاعده‌ی type-aware ساخته شد. هر دو قاعده (`no-raw-user-return`, `restrict-to-private-user`) اکنون تست دائمی RuleTester دارند (۹ تست، همگی سبز) که با اسکریپت ریشه `pnpm test:eslint-rules` (و در نتیجه از طریق `pnpm test` و CI) اجرا می‌شوند.
- **بستن بدهی بیلد `packages/shared` (و کشف یک باگ مشابه در `packages/db`):** هر دو پکیج با `tsup` به `dist` (CJS+ESM+d.ts) بیلد می‌شوند و `apps/api` به `nest start --watch` بازگشت. در حین اثبات زنده کشف شد که `@vaqt/db` هم دقیقاً همان مشکل را داشت (`main` به `.ts` خام اشاره می‌کرد) — چون بدون decorator است، همان راه‌حل tsup روی آن هم اعمال شد. اثبات زنده: پس از حذف کامل `node_modules`/`dist`/`.turbo` و نصب/بیلد از صفر، سرور واقعی روی `nest start` بالا آمد و `POST /auth/otp/verify` پاسخ کامل `PrivateUser` برگرداند (شامل DI سرویس‌های تزریق‌شده در constructor مثل `RedisService`) — نه فقط تعویض ابزار.
- **بازنگری واحد پول (ریال به‌جای تومان):** به بند «مبالغ» بالا مراجعه شود. migration دستی `rename_money_fields_to_rial` (نه diff خودکار Prisma، چون Prisma رنیم را DROP+ADD می‌دید و روی ستون‌های پر رد می‌کرد) فقط rename کرد؛ ایندکس trgm جدول `requests` دست‌نخورده تأیید شد. مقدار واقعی (×۱۰) فقط در `seed.ts` (با `tomanToRial()`) اعمال و با اجرای مجدد seed (دوبار، برای اثبات idempotency) روی Postgres واقعی تأیید شد — شمارش ردیف‌ها ثابت ماند (۸/۱۲/۱۲/۱۵/۲۰/۵).
- schema zod جدید `moneyRialSchema` در `packages/shared/src/schemas/money.ts` (عدد صحیح، مضرب ۱۰، ۱٬۰۰۰ تا ۱۰٬۰۰۰٬۰۰۰٬۰۰۰ ریال) با ۸ تست.

---
