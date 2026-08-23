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

---
