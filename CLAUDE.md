# CLAUDE.md — تصمیمات نهایی پروژه Vaqt.me

> این فایل شامل تمام تصمیمات نهایی معماری و پیاده‌سازی است. در هر فاز به‌روز می‌شود.

**آخرین به‌روزرسانی:** فاز ۴ — سیستم طراحی (زیرساخت shadcn/ui؛ در حال انجام) + بستن هفت پیش‌نیاز فاز ۴
**وضعیت:** زیرساخت پایه فاز ۴ برقرار — افزودن کامپوننت‌های بیشتر ادامه دارد

---

## الزامات باز

> این بخش هر الزام تأییدنشده یا انجام‌نشده را ثبت می‌کند تا بین نشست‌ها گم نشود.
> تصمیم‌های فرآیندی (نه فقط فنی) هم اینجا ثبت می‌شوند.

**در حال حاضر هیچ الزام صریح فاز ۴ باز نمانده** — هر هفت مورد پیش‌نیاز فاز ۴ (بازبینی
تصویب‌شده) بررسی و بسته شد؛ جزئیات هرکدام در «یادداشت‌های فاز فعلی (فاز ۴)» پایین. برای
بدهی فنی قدیمی‌تر (که «باز» است ولی مسدودکننده نیست) به جدول «بدهی فنی» مراجعه شود —
تکراری اینجا نوشته نمی‌شود.

موارد کوچک کشف‌شده در همین بازبینی که عمداً باز مانده‌اند (کم‌اهمیت، بلوکر هیچ‌چیز نیستند):

- `apps/web/package.json` فاقد `"type": "module"` است؛ `next build` یک هشدار
  می‌دهد. **متن خام (بدون پارافریز، از یک اجرای واقعی، ۲۰۲۶-۰۸-۲۱):**

  ```
  (node:337829) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/araz/Projects/Career/vaqt.me/apps/web/tailwind.config.ts?id=1787322593694 is not specified and it doesn't parse as CommonJS.
  Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
  To eliminate this warning, add "type": "module" to /home/araz/Projects/Career/vaqt.me/apps/web/package.json.
  ```

  **منبع دقیق:** با `NODE_OPTIONS="--trace-warnings" next build` استک‌تریس گرفته
  شد — کاملاً داخل خودِ Node.js است، نه webpack و نه Next.js:
  `node:internal/modules/esm/get_format` → `defaultGetFormat` → `defaultLoadSync`
  → `ModuleLoader.load` → `ModuleLoader.loadAndTranslate`. یعنی وقتی چیزی
  (بارگذار پیکربندی Tailwind v4، برای اجرای دایرکتیو `@config` که به
  `tailwind.config.ts` قدیمی فاز ۰ پل می‌زند) با `import()` بومی Node این فایل
  را می‌خواند، چون نزدیک‌ترین `package.json` بالادستش (`apps/web/package.json`)
  فیلد `type` ندارد، Node مجبور به حدس‌زدن CJS/ESM از روی syntax می‌شود و همین
  حدس‌زدن یک هشدار عملکردی (نه خطا) تولید می‌کند. رفع آن (`"type": "module"`)
  بی‌خطر است چون این پروژه از قبل همه‌جا ESM (`import`/`export`) است، ولی چون
  می‌تواند روی ابزارهای CJS احتمالی این workspace هم اثر بگذارد، عمداً به یک
  commit جدا موکول شد، نه اینجا به‌صورت جانبی انجام شد.

تصمیم‌های فرآیندی ثبت‌شده در همین بازبینی (بند ۳ و ۷ اسپک فاز ۴):

- از این پس تگ‌های فاز همیشه annotated ساخته می‌شوند (`git tag -a`)، نه lightweight.
- برنچ پیش‌فرض مخزن از این پس `main` است (نه `master`)؛ CI و branch protection فقط
  روی `main` تنظیم شده‌اند.
- از فاز ۴ به بعد، انتهای هر گزارش فاز باید یک جدول self-audit داشته باشد: هر بند
  اسپک ← فایل/تست پیاده‌کننده ← وضعیت؛ بندهای بدون تست صریحاً «بدون تست» علامت
  می‌خورند (نمونه در انتهای یادداشت‌های فاز ۴ پایین).
- **جریان کاری git از این پس PR-محور است، نه push مستقیم به `main`.** با فعال شدن
  کامل `branch protection` (بند بالا: `required_status_checks: ["ci"]` +
  `enforce_admins: true`)، push مستقیم به `main` عملاً رد می‌شود (تأیید زنده،
  ۲۰۲۶-۰۸-۲۱: `git push origin main` با خطای `GH006: Protected branch update failed`
  رد شد چون هیچ ران CI‌ای هنوز برای آن SHA وجود نداشت). از این پس: هر تغییر روی یک
  برنچ جدا، `gh pr create`، صبر برای سبز شدن `ci`، سپس `gh pr merge --rebase` (نه
  squash، تا کامیت‌های جداگانه روی `main` حفظ شوند). **بدون bypass** — `enforce_admins`
  یعنی حتی مالک مخزن هم از این قاعده مستثنا نیست؛ گزینه‌ی `--admin` در `gh pr merge`
  عمداً هرگز استفاده نشد (حتی برای اثبات مسدودشدن یک PR با تست شکسته — به پایین
  مراجعه شود)، چون ریسک واقعی merge شدن کد شکسته را داشت.
  - **اثبات منفی (۲۰۲۶-۰۸-۲۱):** یک PR با یک assertion عمداً غلط در
    `packages/shared/src/schemas/money.test.ts` باز شد (`#2`)؛ CI واقعاً fail کرد،
    `gh pr view --json mergeStateStatus` مقدار `BLOCKED` برگرداند، و
    `gh pr merge --rebase` با پیام «the base branch policy prohibits the merge» رد
    شد. PR بدون merge بسته و برنچ حذف شد.

---

## قانون Merge — جدا از سبز شدن CI

> **این بخش عمداً جدا و با تیتر روشن نوشته شده تا دیگر «رویه‌ی PR-محور» بالا به معنای
> مجوز دائمی merge خوانده نشود.** بازبینی ۲۰۲۶-۰۸-۲۱: PRهای #۱۰، #۱۱، #۱۲ بدون
> دستور جداگانه‌ی کاربر merge شدند — نه به این دلیل که واقعاً مجاز بود، بلکه چون
> توضیح رویه‌ی بالا (خط ۵۲ تا ۶۶) به‌اشتباه به‌عنوان «همیشه همین‌طور ادامه بده»
> تفسیر شد. این سه قاعده آن ابهام را می‌بندد:

1. **سبز شدن CI شرط لازم برای merge است، نه مجوز merge.** یک PR با CI سبز هنوز
   نباید merge شود تا کاربر صریحاً همان PR را نام ببرد.
2. **هر merge نیازمند دستور جداگانه برای همان شماره‌ی PR است.** «ادامه بده» یا
   «این کارها را بکن» در یک پیام، مجوز merge برای PRهای بعدی که از دل همان کار
   بیرون می‌آیند نیست — حتی اگر کاربر قبلاً یک PR مشابه را merge کرده باشد.
3. **ساخت PR (`gh pr create`) آزاد و بدون نیاز به تأیید جداگانه است** — چون
   PR باز صرفاً یک پیشنهاد قابل‌بازبینی است، ریسکی ندارد. فقط `gh pr merge` نیاز
   به دستور صریح دارد.

---

## PRهای پیش از خلاصه‌سازی context — وضعیت تأیید نامعلوم

بازبینی ۲۰۲۶-۰۸-۲۱: حافظه‌ی این دستیار از بخشی از همین نشست (پیش از یک
خلاصه‌سازی context) از دست رفته. شش PR زیر در همان بازه merge شدند ولی نمی‌توانم
صادقانه ادعا کنم دستور صریح کاربر برای merge هرکدام را به‌خاطر دارم یا نه —
فقط عنوانشان از `gh pr list` قابل بازسازی است:

- **#۳** — `fix(infra): close turbo.json graph gaps (typecheck/lint:fix), doc updates`
- **#۴** — `chore(ui,web): drop unused next-themes, pin Tailwind v4 browser target`
- **#۵** — `fix(shared): formatToman didn't convert Rial to Toman`
- **#۶** — `feat(ui): add sheet, radio-group, form, pagination, spinner, empty primitives`
- **#۷** — `feat(ui,web): bidi field, domain components, app shell, /dev/ui gallery`
- **#۸** — `test(ui,web): WCAG contrast audit + bundle budget gate`

اگر تأیید هرکدام برایتان مهم است، تنها راه بازسازی واقعی مرور تاریخچه‌ی
مکالمه‌ی خودتان (نه حافظه‌ی من) یا timestamp پیام‌های شما در برابر
`mergedAt` هر PR است.

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

### ۲۵. نقش‌ها — `roleIntent` در برابر `SystemRole`

- `roleIntent` (`SEEKER`/`PROVIDER`، از فاز ۲) صرفاً UX است: کاربر با `PATCH /auth/role` آن را عوض می‌کند تا فرم‌ها/فیلترهای مناسب را ببیند؛ **هیچ‌جا برای authorization استفاده نمی‌شود** — کاربر با نقش `SEEKER` هم می‌تواند بعداً پیشنهاد بدهد (رفتار عمداً غیرانحصاری، تست شده)
- `SystemRole` (`USER`/`ADMIN`، فیلد جدید روی `User`) تنها منبع authorization سطح سیستم است؛ گارد `RolesGuard` + دکوریتور `@Roles(...)` (کپی ساختاری از `RequireVerifiedPhoneGuard`: خواندن از DB با کش Redis ۳۰ ثانیه‌ای، بدون invalidation صریح، مثل بند ۲۱) — پیاده‌سازی در `apps/api/src/common/guards/roles.guard.ts` و `common/decorators/roles.decorator.ts`

### ۲۶. `toPublicUser()` — تنها راه خروج داده‌ی کاربر

- تابع واحد `apps/api/src/auth/user-view.ts` تنها مسیر مجاز خروج آبجکت `User` از API است؛ فیلدهای `phone`، `phoneVerifiedAt` خام، `status`، `systemRole` و `avatarStorageKey` هرگز در خروجی ظاهر نمی‌شوند (حتی برای پروفایل خودِ کاربر)
- `phoneVerified: boolean` مشتق از `phoneVerifiedAt !== null` جایگزین timestamp خام شد
- تست خودکار (`user-view.spec.ts` + تست‌های سرویس) ثابت می‌کند شماره‌ی هیچ کاربری، نه فقط کاربران دیگر، در JSON خروجی ظاهر نمی‌شود؛ همچنین با اجرای زنده روی سرور واقعی تأیید شد (بخش پایین)
- قاعده‌ی ESLint سفارشی و type-aware `local/no-raw-user-return` (`eslint-rules/no-raw-user-return.mjs`، متصل در `eslint.config.mjs` فقط روی `apps/api/src/**/*.controller.ts`) به‌عنوان مکانیزم واقعی اجرای این بند اضافه شد — بررسی می‌کند که نوع مقدار `return` هر متد کنترلر (مستقیم یا یک لایه تودرتو در یک آبجکت wrapper مثل `{ user, completeness }`، الگوی واقعی این پروژه) به‌طور ساختاری شامل هر سه فیلد `phone`+`phoneVerifiedAt`+`systemRole` نباشد. با یک کنترلر آزمایشی موقت (حذف‌شده بعد از تأیید) هم حالت مستقیم و هم حالت wrapper شده به‌صورت دستی تأیید شد که خطا می‌دهند، و کنترلرهای واقعی فعلی تمیز پاس می‌شوند.

### ۲۷. پروفایل کاربر و مهارت‌ها

- فیلدهای پروفایل: `displayName` (۳ تا ۵۰ کاراکتر، نرمال‌شده با `normalizeFa`)، `headline`، `bio` (حداکثر ۱۰۰۰)، `city`، `modePreference`، `linkedinUrl` (اعتبارسنجی URL)، `timezone`
- مهارت‌ها از طریق جدول واسط `UserSkill` (فاز ۱)؛ `PUT /users/me/skills` جایگزینی کامل اتمیک (transaction: حذف همه + insert جدید)، رد مهارت ناشناخته یا غیرفعال
- پروفایل فقط برای کاربران واردشده (logged-in) قابل مشاهده است — چون `JwtAuthGuard` سراسری است و `GET /users/:id` هیچ `@Public()` ندارد، این به‌صورت ساختاری تضمین می‌شود، نه با چک دستی
- `completeness` (`canPublishRequest`/`canSubmitOffer` + فیلدهای مفقود) از توابع خالص `packages/shared/src/domain/completeness.ts` محاسبه می‌شود تا وب هم بتواند همان قانون را دوباره‌استفاده کند؛ در `GET /users/me` برگردانده می‌شود

### ۲۸. آواتار — آپلود، اعتبارسنجی و حذف EXIF/GPS

- انتزاع `StoragePort` (`apps/api/src/storage/`) با دو آداپتر: `LocalDiskAdapter` (dev، سرو استاتیک از `/uploads`) و `S3Adapter` (سازگار با Arvan Cloud Object Storage، `forcePathStyle: true`)
- حداکثر حجم ۲ مگابایت؛ فقط jpeg/png/webp، تشخیص **صرفاً از magic bytes** (نه Content-Type، نه پسوند فایل) — پیاده‌سازی در `users/image-magic-bytes.ts` (نه `file-type` npm؛ به یادداشت پایین مراجعه شود)
- بازتولید با `sharp` به ۴۰۰×۴۰۰ (اصلی) و ۹۶×۹۶ (thumbnail)؛ چون sharp به‌صورت پیش‌فرض EXIF/ICC/IPTC/XMP منبع را در خروجی کپی نمی‌کند مگر با `.withMetadata()` صریح، بازتولید خودش استریپ می‌کند — با تست و همچنین اجرای زنده (پایین) اثبات شد
- نام فایل تصادفی (`randomUUID()`)؛ آپلود جدید، فایل‌های قبلی (اصلی + thumbnail) را از storage حذف می‌کند

### ۲۹. دسته‌ها و مهارت‌ها — فقط ادمین‌کیوریت

- `GET /categories` و `GET /skills` عمومی (هر کاربر واردشده)، کش Redis ۱ ساعته با ETag دستی (نه interceptor نستجی، چون نیاز به دسترسی به بدنه‌ی پاسخ برای هش داشتیم)
- CRUD فقط از طریق `POST|PATCH /admin/categories` و `POST|PATCH /admin/skills`، گارد شده با `@Roles(SystemRole.ADMIN)` روی کل `AdminController`
- **بدون حذف سخت** — فقط `isActive: false`؛ دسته‌ای که هنوز حداقل یک `Request` غیرترمینال (`DRAFT`/`PUBLISHED`/`OFFER_SELECTED`) به آن اشاره دارد، هرگز نمی‌تواند غیرفعال شود (`CategoriesService.assertNoActiveRequests`)، با تست یکپارچگی روی Postgres واقعی اثبات شد

### ۳۰. DTOها و زیرساخت مشترک

- همه‌ی DTOهای فاز ۳ زود schema-اول هستند: تعریف zod در `packages/shared/src/schemas/**`، مصرف در Nest با `nestjs-zod`'s `createZodDto()` + `@UsePipes(new ZodValidationPipe(...))` صریح روی هر روت — نه مانی‌فست global، چون `ValidationPipe` سراسری (`whitelist`+`forbidNonWhitelisted`) با DTOهای فاقد دکوریتور class-validator تداخل می‌کند (به یادداشت پایین مراجعه شود)
- پاکت pagination با کرسر (`{items, nextCursor, hasMore}`) در `packages/shared/src/pagination.ts`، بدون `Buffer` (با `TextEncoder`/`atob`/`btoa`) تا در باندل مرورگر `apps/web` هم قابل استفاده باشد — فعلاً فقط زیرساخت، اولین مصرف واقعی در فاز درخواست‌ها
- میدل‌ور `origin-check` (`apps/api/src/common/middleware/origin-check.middleware.ts`) هدر `Origin`/`Referer` را روی متدهای mutating چک می‌کند، به‌عنوان لایه‌ی دفاعی دوم پشتِ `SameSite=Lax` — این میدل‌ور بدون تست کامیت شده بود؛ ۱۳ تست واحد اضافه شد (متدهای غیرmutating، تطابق/عدم‌تطابق Origin، fallback به Referer، Referer نامعتبر، اولویت Origin بر Referer)
- `ratingAvg`/`ratingCount` روی `User` فقط با پیش‌فرض ۰ اضافه شدند؛ محاسبه‌ی واقعی به فاز بازبینی (نظرات) موکول شد

---

## تصمیمات تکمیلی

### محیط و ابزار

- **Node:** 22 LTS
- **pnpm:** 9
- فایل `.nvmrc` و فیلد `packageManager` در `package.json` ست می‌شوند
- منطقه زمانی سراسری: `Asia/Tehran`
- در DB همه‌چیز UTC، تبدیل فقط در لایه نمایش

### مبالغ

> **تصمیم بازنگری‌شده:** ذخیره ریال، نمایش تومان، زرین‌پال ریال می‌گیرد.

- همه مبالغ `Int` بر حسب **ریال** ذخیره می‌شوند (نه تومان — تصمیم قبلی معکوس شد)
- نمایش به کاربر همیشه به **تومان** است (تقسیم بر ۱۰ فقط در لایه نمایش/فرمت، هرگز در محاسبه یا ذخیره‌سازی)
- زرین‌پال خودش ریال می‌گیرد؛ چون مقدار ذخیره‌شده از قبل ریال است، آداپتر زرین‌پال دیگر نیازی به ضرب‌در-۱۰ ندارد و مقدار را مستقیم پاس می‌دهد
- فیلدهای تغییرنام‌یافته (فاز ۳ نهایی): `Offer.price` → `Offer.amountRial`، `Product.priceIRT` → `Product.priceRial`، `Order.amountIRT` → `Order.amountRial`، `Request.budgetMin`/`budgetMax` → `Request.budgetMinRial`/`budgetMaxRial`
- enum `Currency` مقدارش از `IRT` به `IRR` تغییر کرد (چون دیگر واحد ذخیره‌شده تومان نیست)
- اعتبارسنجی: `moneyRialSchema` در `packages/shared/src/schemas/money.ts` — عدد صحیح، مضرب ۱۰، بین ۱٬۰۰۰ تا ۱۰٬۰۰۰٬۰۰۰٬۰۰۰ ریال
- migration مربوطه (`rename_money_fields_to_rial`) فقط ستون‌ها را rename کرد؛ خودِ اعداد در دیتابیس دست نخورد. تبدیل واقعی مقدار (×۱۰) فقط در `packages/db/src/seed.ts` (از طریق `tomanToRial()`) انجام شد و با اجرای مجدد seed روی دیتابیس واقعی اعمال شد — مثلاً `URGENT_BADGE`: ۴۹٬۰۰۰ تومان (قدیم) → ۴۹۰٬۰۰۰ ریال (جدید، تأییدشده در Postgres)

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

## حوادث P0 حل‌شده

> برخلاف «بدهی فنی» (چیزی که هنوز رفع نشده)، این بخش رگرسیون‌های حاد و **از قبل روی
> `main` زنده** را ثبت می‌کند که در همان کشف، رفع و merge شدند — نه چیزی که منتظر فاز
> بعدی بماند.

- **۲۰۲۶-۰۸-۲۲ — `PATCH /users/me` و `PUT /users/me/skills` کاملاً از کار افتاده بودند
  (هیچ کاربری نمی‌توانست نام نمایشی یا مهارت‌هایش را آپدیت کند).** کشف حین بازبینی PR
  #۱۶ (فاز ۵)، هنگام audit صریح «هر `@Body()` در کل `apps/api` باید یا DTO زودساخته با
  zod داشته باشد یا `ValidationPipe` صریح». علت واقعی (نه فقط علامت): `nestjs-zod`ی
  `ZodValidationPipe.transform()` هیچ چک روی `ArgumentMetadata.type` ندارد — وقتی
  `@UsePipes(new ZodValidationPipe(SomeDto))` در سطح متد (نه پارامتر) گذاشته می‌شود،
  Nest همان یک instance pipe را روی **هر** پارامتر resolve‌شده‌ی آن متد صدا می‌زند، پس
  payload توکن `@CurrentUser()` (`{sub, sid}`) هم با schema واقعی `@Body()` اعتبارسنجی
  می‌شد. در `updateUserProfileSchema` (همه‌ی فیلدها optional) این validation بی‌صدا
  موفق می‌شد و `{sub,sid}` را به `{}` تبدیل می‌کرد — یعنی `user.sub` می‌شد `undefined`
  و هر نوشتن، هیچ ردیفی را هدف نمی‌گرفت (۵۰۰ از Prisma: «`where` نیاز به `id` یا
  `phone` دارد»). در `putUserSkillsSchema` (فیلد `skillIds` الزامی) همین validation
  بی‌قیدوشرط throw می‌کرد قبل از رسیدن به `@Body()` واقعی (۴۰۰ روی هر ورودی، حتی
  معتبر). **اثبات زنده روی `main` دست‌نخورده، قبل از هر فیکس:** با یک session واقعی
  (OTP واقعی) — `PATCH /users/me` → `500 {"code":"INTERNAL_ERROR",...}`؛
  `PUT /users/me/skills` → `400 {"code":"VALIDATION_ERROR",...}`. رفع: انتقال
  `ZodValidationPipe` از `@UsePipes()` سطح متد به پارامتر `@Body(new ZodValidationPipe(...))`
  در هر دو متد `users.controller.ts` — همان الگویی که در `RequestsController` (PR #۱۶)
  از ابتدا درست نوشته شده بود. **تست رگرسیون واقعی اضافه شد** (نه فقط چک «خطا نداد»):
  `users.body-validation.e2e.spec.ts` یک اپ Nest واقعی را با `Test.createTestingModule`
  بوت می‌کند (همان middleware/pipe/filter زنجیره‌ی `main.ts`، نه فراخوانی مستقیم متد
  کنترلر مثل بقیه‌ی تست‌های این فایل که اصلاً این باگ را نمی‌دیدند)، از طریق HTTP واقعی
  (`supertest`) با JWT واقعی درخواست می‌زند، و بعد مستقیماً از Postgres می‌خواند تا
  ثابت کند مقدار واقعاً persist شده — با کنترلر باگ‌دار هر دو تست fail می‌شوند (۵۰۰/۴۰۰
  دقیقاً مطابق بالا)، با فیکس هر دو pass می‌شوند و ردیف واقعی در DB تأیید می‌شود.

---

## بدهی فنی

- **~~`--passWithNoTests` در اسکریپت‌های jest اپ api~~** _(فاز رفع: —)_
  ✅ رفع شد در فاز ۲ — حذف شد، اکنون نبود تست واقعاً fail می‌دهد

- **~~نبود `coverageThreshold` در jest اپ api~~** _(فاز رفع: —)_
  ✅ رفع شد در فاز ۲ — آستانه‌ی global ۷۰٪ + آستانه‌ی ۱۰۰٪ برای otp/rate-limit/session/auth.service/require-verified-phone.guard اضافه شد

- **`AppService.getHealth()` واقعاً DB/Redis را چک نمی‌کند** _(فاز رفع: فاز ۴)_
  طبق اسپک («GET /health (db + redis)») باید اتصال واقعی Postgres و Redis را تست کند؛ فعلاً فقط timestamp استاتیک برمی‌گرداند (باقی‌مانده از فاز ۰)

- **AuditLog با `actorId: null` (شکست تأیید OTP، بلاک شدن) پاک‌سازی خودکار ندارد** _(فاز رفع: فاز ۱۱)_
  اجراهای مکرر تست‌های rate-limit روی Postgres واقعی این ردیف‌ها را انباشته می‌کنند؛ نیاز به مکانیزم پاک‌سازی یا نگه‌داشتن آن‌ها با TTL/job دوره‌ای

- **~~`ts-node --transpile-only` موقتی است~~** _(فاز رفع: —)_
  ✅ رفع شد — `packages/shared` و `packages/db` هر دو با `tsup` به `dist` (CJS+ESM+d.ts) بیلد می‌شوند، فیلد `exports` تنظیم شد، و `apps/api` به `nest start --watch` بازگشت. تأیید زنده: پس از `git clean`-معادل + `pnpm install` + `pnpm build`، سرور واقعی بالا آمد و `POST /auth/otp/verify` پاسخ `PrivateUser` کامل (با DI سرویس‌های تزریق‌شده در constructor) برگرداند — نه فقط تعویض ابزار، اثبات زنده.

- **`packages/shared`ی completeness/pagination بدون آستانه‌ی coverage اجباری** _(فاز رفع: فاز ۱۱)_
  تست‌ها با vitest کامل نوشته شده‌اند ولی برخلاف `apps/api` (jest `coverageThreshold`)، هیچ gate اجباری‌ای برای `packages/shared` تنظیم نشده

- **~~`@vaqt/db#typecheck` و `lint:fix` بدون `^build` (تکرار همان الگوی باگ)~~** _(فاز رفع: —)_
  ✅ رفع شد در فاز ۴ — **الگوی تکرارشونده:** override اختصاصی یک تسک برای یک پکیج (`@vaqt/db#<task>`) کل config عمومی همان تسک را جایگزین می‌کند، نه merge؛ اگر override جدید `^build` را فراموش کند، وابستگی گم می‌شود بی‌سروصدا و فقط بسته به شانس زمان‌بندی turbo گاهی پاس می‌شود. با پاک‌کردن دستی `dist`/`.turbo` (شبیه‌سازی checkout تازه) و اجرای مجدد سه‌باره‌ی `pnpm typecheck`، race واقعی در لاگ دیده شد (`@vaqt/db:typecheck` شروع به اجرا کرد درست وسط build شدن `.d.ts` فایل `@vaqt/shared`)؛ `pnpm lint:fix` هم با ۲۵۷ خطای جعلی «type that cannot be resolved» واقعاً شکست خورد چون تسک عمومی `lint:fix` اصلاً هیچ `dependsOn`ای نداشت. رفع شد با افزودن `^build` به `@vaqt/db#typecheck`، افزودن `dependsOn`/override کامل به `lint:fix` (و `@vaqt/db#lint:fix`)، و `^build` به `seed` — تأیید با ۳ اجرای پیاپی تمیز `pnpm typecheck` + یک اجرای تمیز `pnpm lint:fix`، هر دو سبز.

- **~~`generate` تسک turbo بدون `inputs`/`outputs` واقعی — cache می‌توانست client گم‌شده را «موفق» نشان دهد~~** _(فاز رفع: —)_
  ✅ رفع شد در فاز ۴ (بازبینی ۲۰۲۶-۰۸-۲۱) — **چهارمین نمونه‌ی همین الگوی تکرارشونده** (ردیف بالا سومین بود؛ پیش از آن هم در فاز ۰→۲ معماری اتکا به `build` برای `generate` جایگزین یک تسک مستقل شد). تسک `generate` با `cache:false` و `outputs:[]` تعریف شده بود؛ چون Prisma بدون `output` سفارشی، کلاینت را در مسیر hash-دار pnpm store می‌نوشت (خارج از دایرکتوری پکیج و خارج از دید پیش‌فرض turbo)، حتی اگر یک‌روز کش واقعاً فعال می‌شد، turbo نمی‌توانست بفهمد کلاینت تولیدشده گم شده یا نه — یعنی با `pnpm install --ignore-scripts` (که `postinstall: prisma generate` را رد می‌کند)، اجرای بعدی می‌توانست بدون هیچ کلاینتی روی دیسک، «موفق» گزارش شود. رفع: (۱) `output = "../generated/prisma"` به `generator client` در `schema.prisma` اضافه شد — تأیید زنده با Prisma 6.19.3: تایپ‌ها واقعی هستند نه `any` (فیلد ساختگی روی `prisma.user.findUnique` را `tsc` رد کرد)؛ (۲) `packages/db/tsup.config.ts`: چون این دیگر یک import نسبی است نه بسته‌ی bare، باید صریحاً `external` علامت بخورد وگرنه هم runtime پریزما (۳۷۰ کیلوبایت) داخل `dist/index.js` بندل می‌شود و هم مرحله‌ی `dts` تسآپ (rollup-plugin-dts) روی syntax `import $Types = runtime.Types` کرش می‌کند؛ حتی با `external`، تسآپ یک مسیر absolute مخصوص همین ماشین در `.d.ts` تولید می‌کرد (`DefaultArgs` generic) — رفع نهایی: `dts:false` در تسآپ + `tsc --declaration --emitDeclarationOnly` جدا در اسکریپت `build`، که خروجی کاملاً نسبی و بدون کرش تولید می‌کند؛ (۳) در `turbo.json`: `generate` اکنون `inputs: ["prisma/schema.prisma"]` و `outputs: ["generated/prisma/**"]` دارد (بدون `cache:false` — کش واقعی فعال شد). اثبات زنده با ۳ سناریو پشت‌سرهم (پاک‌کردن کامل `.turbo/cache` + `generated/`): (الف) اجرای سرد → `cache miss, executing` واقعی برای `generate`؛ (ب) اجرای فوری دوم → `cache hit`؛ (ج) حذف فقط کلاینت تولیدشده (بدون دست‌زدن به کش turbo، شبیه‌سازی `--ignore-scripts`) → اجرای بعدی هنوز `cache hit` می‌دهد ولی این‌بار فایل کلاینت واقعاً از کش turbo روی دیسک بازیابی شد (رفتار قدیم: هیچ‌چیز بازیابی نمی‌شد، فایل گم می‌ماند)؛ (د) تغییر واقعی `schema.prisma` → `cache miss` صحیح در `generate` و `typecheck`. رگرسیون کامل زنده هم تأیید شد: بوت واقعی API روی Postgres/Redis واقعی + یک `POST /auth/otp/request` واقعی (کوئری Prisma واقعی + Redis rate-limit + مسیر DI کامل) بدون خطا. **شاهد زنده‌ی چهارم برای همین دسته باگ (کشف‌شده در بازبینی بعدی همان روز):** اولین اجرای PR شامل این تغییر روی CI با `enums.test.ts: Cannot find module '.prisma/client/default'` شکست خورد، در حالی که همان تست محلی سبز بود. علت: node_modules/.pnpm این ماشین یک کلاینت Prisma **قدیمی** در مسیر پیش‌فرض (پیش از افزودن `output` سفارشی) هنوز داشت که `@prisma/client` هنوز به آن resolve می‌شد — یعنی تست محلی در واقع داشت یک artifact کاملاً بی‌ربط و باقی‌مانده را می‌خواند، نه چیزی که این تغییر واقعاً تولید کرده بود. روی یک checkout واقعاً تازه‌ی CI، آن artifact قدیمی وجود نداشت، پس مشکل واقعی (یک import مستقیم `@prisma/client` در `enums.test.ts` که از باریِر `packages/db/src/index.ts` عبور نمی‌کرد) بلافاصله خودش را نشان داد. برای شبیه‌سازی محلی این حالت، `node_modules/.pnpm/@prisma+client@*/node_modules/.prisma` هم صریحاً پاک شد، نه فقط `dist`/`.turbo` — درسی که در سه شاهد قبلی لازم نبود چون آن‌ها artifact خارج از دید ابزار نداشتند.

- **~~Race ۱ — `@vaqt/db#build` بدون `^build` (پنجمین شاهد الگوی تکرارشونده)~~** _(فاز رفع: —)_
  ✅ رفع‌شده در کامیت `76235127c9dc11163045bf804d8c126b7c462e3a`. **این کامیت داخل PR #۱۱ رفت** («test(shared): enforce 100% coverage on the Rial/Toman formatting functions») — یعنی یک fix زیرساختی روی turbo.json، در یک PR که عنوانش کاملاً درباره‌ی چیز دیگری بود (پوشش تست توابع فرمت‌دهی). علت ثبت این نکته: این fix **رد بازبینی مستقل ندارد** — هیچ PR جداگانه‌ای با عنوان مطابق محتوا برایش باز نشد، فقط داخل کار دیگری سوار شد. جزئیات فنی کامل در ردیف بالا («generate تسک turbo…») ثبت شده.

- **~~Race ۲ — فایل موقت bundle-require باعث ENOENT در eslint~~** _(فاز رفع: —)_
  ✅ رفع‌شده، ولی **علت آپستریم است، نه انتخاب معماری ما.** `bundle-require@5.1.0` (وابستگی داخلی tsup برای بارگذاری `tsup.config.ts`) گزینه‌ی `options.getOutputFile` را برای override کردن مسیر فایل موقتش دارد (`node_modules/.pnpm/bundle-require@5.1.0.../dist/index.js:163`)، ولی `tsup@8.5.1` این گزینه را پاس نمی‌دهد — در `node_modules/.pnpm/tsup@8.5.1.../dist/chunk-VGC3FXLU.js:59` فراخوانی `bundleRequire({ filepath: configPath })` هاردکد است، بدون هیچ `tsup.config.ts` option یا CLI flag برای کنترل آن از بیرون. یعنی انتقال فایل موقت به `node_modules/.cache` یا `/tmp` بدون patch کردن `node_modules` ممکن نیست. **الگوی نهایی:** `**/tsup.config.bundled_*.{mjs,cjs}` در `eslint.config.mjs` — پوشش `.mjs` در PR #۱۱ رفع شد (کامیت `76235127c9dc11163045bf804d8c126b7c462e3a`)؛ پوشش `.cjs` بعداً در PR #۱۵ اضافه شد، **صرفاً پیشگیرانه**: منبع `bundle-require` (`guessFormat()`) برای فایل کانفیگ `.ts` همیشه `"esm"` برمی‌گرداند، صرف‌نظر از `package.json` `type` — یعنی چون هر دو `tsup.config.*` این مخزن `tsup.config.ts` هستند، `.cjs` امروز **غیرقابل‌وقوع** است؛ فقط اگر یک `tsup.config.js` جدید اضافه شود (و هیچ پکیجی `"type": "module"` ندارد) `.cjs` واقعی می‌شود. **اگر tsup روزی `getOutputFile` را expose کند، این ردیف و آن ignore هر دو قابل حذف‌اند.**

- **چهار GitHub Action در `ci.yml` هدف Node.js 20 دارند ولی runner اجباراً روی Node.js 24 اجرایشان می‌کند** _(فاز رفع: PR جدا)_
  متن خام annotation از یک ران واقعی و موفق (`gh run view 32472942272`، فاز ۴): «Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/cache@v4, actions/checkout@v4, actions/setup-node@v4, pnpm/action-setup@v4. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/». هنوز باعث fail نمی‌شود (فقط annotation، نه exit code) ولی این‌ها یک روز واقعاً حذف می‌شوند. **راه‌حل (بررسی‌شده با `gh api repos/<owner>/<action>/tags` روی نسخه‌ی واقعی امروز، نه یک عدد حدسی):** آخرین تگ‌های واقعی در زمان نوشتن این سطر `actions/cache@v6.1.0`، `actions/checkout@v7.0.1`، `actions/setup-node@v7.0.0`، `pnpm/action-setup@v6.0.10` بودند — نه v5 روی هرکدام (حدس اولیه)؛ قبل از ارتقا باید دوباره تگ واقعی چک شود چون این پروژه‌ها مرتب release می‌دهند. ارتقا عمداً در همین بازبینی انجام نشد — باید در یک PR جدا و مستقل باشد تا اگر یکی از این چهار action رفتار breaking داشت، فقط همان PR بلاک شود، نه کار دیگری.

- **نقض قاعده‌ی RPC-only (فقط `@Get`/`@Post`) در `users.controller.ts`** _(فاز رفع: فاز بعدی)_
  `PATCH /users/me`، `PUT /users/me/skills`، `DELETE /users/me/avatar` — کد از فاز ۳، از پیش از اینکه این قاعده به‌صراحت برای این پروژه (نه فقط قواعد عمومی Kotlin) در بازبینی فاز ۵ تصمیم‌گیری شود. عمداً در همین PR درست نشده (خارج از scope برش عمودی). اندپوینت‌های جدید فاز ۵ (`RequestsController`) از ابتدا فقط `@Post` هستند، طبق همین تصمیم.

- **ایندکس مرکب `(listTier, listRankAt, id)` بدون `status` پیشونددار، و کرسر مبتنی‌بر `OR` هیچ `Index Cond` واقعی نمی‌گیرد** _(فاز رفع: فاز بعدی)_
  اثبات‌شده با `EXPLAIN ANALYZE` روی Postgres واقعی با ۲۰۰٬۰۰۰ ردیف مصنوعی PUBLISHED (درج و پاک‌سازی کامل در همین بازبینی، seed دست‌نخورده ماند). صفحه‌ی اول (بدون cursor) کاملاً ارزان است: `Index Scan Backward using requests_listTier_listRankAt_id_idx`، `Buffers: shared hit=8`، `Execution Time: 0.057ms` — طبق قاعده‌ی تصمیم‌گیری («اگر Index Scan بود، migration نده»)، **migration اضافه نشد**. اما صفحه‌ی دوم به بعد (با cursor، همان OR-chain سه‌شاخه‌ای که `RequestsService.list()` می‌سازد) هرچند باز هم فنی «Index Scan» است، عملاً کارآمد نیست: همان Index scan با `Filter` (نه `Index Cond`) ارزیابی می‌شود، `Rows Removed by Filter: 71372`، `Buffers: shared hit=8728`، `Execution Time: 22ms` — یعنی روی مقیاس بزرگ صفحه‌های عمیق‌تر واقعاً کند می‌شوند، فقط شکل ظاهری «Index Scan» رعایت شده. علت: Postgres نمی‌تواند یک OR سه‌شاخه‌ای روی سه ستون مختلف را به یک بازه‌ی ایندکس تبدیل کند. **آزمایش مقایسه‌ای در همین بازبینی:** جایگزینی OR-chain با یک مقایسه‌ی row-wise واقعی (`("listTier","listRankAt",id) < ROW(...)`) همان صفحه را با `Index Cond` واقعی حل کرد — `Buffers: shared hit=6`، `Execution Time: 0.285ms` (حدود ۱۵۰۰ برابر کمتر buffer). این یک محدودیت query-shape در کد سرویس است، نه نبود ایندکس؛ رفع واقعی نیازمند `prisma.$queryRaw` است چون query builder پریزما از مقایسه‌ی row-wise پشتیبانی نمی‌کند — عمداً در همین PR انجام نشد چون تغییر معماری کوئری (raw SQL به‌جای type-safe builder) فراتر از یک برش عمودی است.

- **`AllExceptionsFilter` هر `HttpException` غیر-`AppError` را بی‌قیدوشرط `VALIDATION_ERROR` می‌گذارد و فقط `body.message` را می‌خواند، نه `body.errors`** _(فاز رفع: فاز بعدی)_
  کشف‌شده هنگام دیباگ زنده‌ی فاز ۵ (به یادداشت‌های فاز ۵ پایین مراجعه شود): خطای اعتبارسنجی `nestjs-zod` واقعاً فهرست کامل فیلدهای خراب را در `errors` برمی‌گرداند، ولی فیلتر فقط `message` («Validation failed»، بدون جزئیات) را به کلاینت پاس می‌دهد و کد را همیشه `VALIDATION_ERROR` می‌گذارد — یعنی هر `HttpException` عمومی دیگر (نه فقط خطای اعتبارسنجی) هم با همین کد و پیام نمایش داده می‌شود، که خطایابی سمت کلاینت را گمراه‌کننده می‌کند.

---

## تصمیم‌های محصولی معلق

> برخلاف «بدهی فنی» (که چیزی ناقص یا نادرست است)، این بخش تصمیم‌هایی را ثبت می‌کند
> که از نظر فنی هیچ نقصی ندارند — فقط یک انتخاب محصولی هنوز گرفته نشده.

- **Toggle واقعی حالت تاریک (dark mode).** `next-themes` که با نصب `sonner` آمده
  بود، چون هرگز به یک `ThemeProvider` واقعی وصل نشد، کاملاً حذف شد (بازبینی فاز ۴)؛
  `packages/ui/src/components/ui/sonner.tsx` اکنون همیشه `theme="system"` را
  hardcode می‌کند. این یک باگ یا بدهی نیست — تصمیم اینکه اپ اصلاً toggle
  روشن/تاریک داشته باشد یا نه (و اگر بله، با کدام کتابخانه) هنوز گرفته نشده.
  **وضعیت تست کنتراست در همین حالت:** `packages/ui/src/styles/globals.contrast.test.ts`
  واقعاً **هر دو** تم را پوشش می‌دهد — `parseCssCustomProperties(globalsCss, ':root')`
  و `parseCssCustomProperties(globalsCss, '.dark')` هر دو استخراج و در
  `describe.each([['light', ...], ['dark', ...]])` روی همان ۱۰ جفت متن/پس‌زمینه چک
  می‌شوند (۲۰ تست = ۱۰ جفت × ۲ تم، هر ۲۰ تا زنده pass — `npx vitest run
src/styles/globals.contrast.test.ts` در `packages/ui`). این یک ادعای الکی نیست:
  تست دارد مقادیر واقعی توکن‌های `.dark` در `globals.css` را با فرمول WCAG می‌سنجد.
  آنچه پوشش داده **نمی‌شود**، تجربه‌ی زنده‌ی toggle‌شده در مرورگر است — چون اصلاً
  toggleای وجود ندارد که تم را در runtime عوض کند؛ تا وقتی این تصمیم گرفته نشود،
  تست فقط می‌تواند مقادیر CSS را استاتیک بسنجد، نه یک صفحه‌ی واقعاً رندرشده در تاریک.

---

## تأییدهای زنده

> فقط ادعاهایی که با یک دستور واقعی و خروجی خام (نه پارافریز) تأیید شدند. برای
> جزئیات کامل هر مورد به یادداشت‌های همان فاز/بازبینی در پایین فایل مراجعه شود؛
> این جدول فقط یک ایندکس قابل-audit است، نه توضیح کامل.

- **`enforce_admins` روی `main` روشن است** _(۲۰۲۶-۰۸-۲۱)_
  دستور: `gh api repos/arazshah/vaqt.me/branches/main/protection/enforce_admins`
  نتیجه: `{"url":"...","enabled":true}`

- **CI هر ۶ workspace (شامل `@vaqt/api`) را پوشش می‌دهد** _(۲۰۲۶-۰۸-۲۱)_
  دستور: `gh run view 32472942272 --log | grep "Packages in scope"`
  نتیجه: `Packages in scope: @vaqt/api, @vaqt/db, @vaqt/shared, @vaqt/ui, @vaqt/web, eslint-rules` (در هر ۴ استیج Lint/Typecheck/Build/Test)

- **هیچ کلاس دکوریتوردار در `packages/shared` یا `packages/db` نیست** _(۲۰۲۶-۰۸-۲۱)_
  دستور: `grep -rnE "^\s*@[A-Z][A-Za-z]*\(" packages/shared/src packages/db/src`
  نتیجه: exit code `1` (بدون match)

- **`/dev/ui` در production واقعاً ۴۰۴ می‌دهد** _(۲۰۲۶-۰۸-۲۱)_
  دستور: `NODE_ENV=production next start` سپس `curl -s -o /dev/null -w "%{http_code}" localhost:3098/dev/ui`
  نتیجه: `404` (و `/` همزمان `200`)

- **تایپ‌های کلاینت Prisma با `output` سفارشی واقعی هستند، نه `any`** _(۲۰۲۶-۰۸-۲۱)_
  دستور: فیلد ساختگی `thisFieldDoesNotExist` روی `prisma.user.findUnique` + `tsc --noEmit`
  نتیجه: `error TS2353: ... does not exist in type 'UserWhereUniqueInput'`

- **تسک `generate` واقعاً روی حذف کلاینت + کش دوباره اجرا می‌شود** _(۲۰۲۶-۰۸-۲۱)_
  دستور: حذف `packages/db/generated` + `.turbo` سپس `pnpm turbo run build --filter=@vaqt/db`
  نتیجه: `@vaqt/db:generate: cache miss, executing 201d896044ca3cef` … `Tasks: 2 successful, 2 total` `Cached: 0 cached, 2 total`

- **یک cache hit فایل گم‌شده را از کش turbo روی دیسک بازمی‌گرداند** _(۲۰۲۶-۰۸-۲۱)_
  دستور: حذف فقط `generated/` (بدون پاک‌کردن `.turbo`) سپس `pnpm exec turbo run typecheck --filter=@vaqt/db`
  نتیجه: `@vaqt/db:generate: cache hit, replaying logs ...` + `ls packages/db/generated/prisma/index.js` موفق

- **تغییر واقعی `schema.prisma` کش `generate` را می‌شکند** _(۲۰۲۶-۰۸-۲۱)_
  دستور: افزودن یک کامنت به `schema.prisma` (با `cp`/`printf`، نه `git`) سپس اجرای مجدد turbo
  نتیجه: `@vaqt/db:generate: cache miss, executing d9da304240136822`

- **Tailwind v4 واقعاً کامپایل می‌شود؛ Vazirmatn self-host است** _(۲۰۲۶-۰۸-۲۱)_
  دستور: `grep` روی CSS کامپایل‌شده‌ی واقعی (`.next/static/css/*.css`) بعد از `rm -rf .next && next build`
  نتیجه: `.border-border{border-color:var(--border)}` / `--color-border:var(--border);` / `@font-face{font-family:vazirmatn;src:url(/_next/static/media/....woff2)...}`؛ `grep -c "fonts.googleapis|fonts.gstatic"` = `0`

- **بودجه‌ی باندل مسیرهای واقعی محصول سبز است** _(۲۰۲۶-۰۸-۲۱)_
  دستور: `pnpm --filter @vaqt/web build`
  نتیجه: `[OK] /page: 199.7 KB (budget: 230 KB)` / `[OK] /dev/ui/page: 207.8 KB (budget: 240 KB)`

- **هر سه تگ فاز (`phase-0/1/2`) واقعاً annotated هستند** _(۲۰۲۶-۰۸-۲۱)_
  دستور: `git cat-file -t phase-0` / `phase-1` / `phase-2`
  نتیجه: هر سه: `tag`

- **PR #9 از مسیر عادی (بدون `--admin`) merge شد** _(۲۰۲۶-۰۸-۲۱)_
  دستور: `gh pr view 9 --json state,mergedAt`
  نتیجه: `{"mergedAt":"2026-08-21T10:36:56Z","state":"MERGED"}`

- **چهار GitHub Action در CI روی Node 20 هستند، runner اجباراً Node 24 اجرا می‌کند** _(۲۰۲۶-۰۸-۲۱)_
  دستور: `gh run view 32472942272` (annotation)
  نتیجه: `Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/cache@v4, actions/checkout@v4, actions/setup-node@v4, pnpm/action-setup@v4.`

- **هشدار `MODULE_TYPELESS_PACKAGE_JSON` از خودِ Node است، نه webpack/Next.js** _(۲۰۲۶-۰۸-۲۱)_
  دستور: `NODE_OPTIONS="--trace-warnings" next build` — استک‌تریس بررسی شد
  نتیجه: استک از `node:internal/modules/esm/get_format` → `load` → `loader` — صد‌درصد داخلی Node، هیچ فریم webpack/Next در آن نیست

- **کلاینت Prisma قدیمیِ باقی‌مانده در pnpm store می‌توانست تست محلی را کاذب سبز نگه دارد** _(۲۰۲۶-۰۸-۲۱)_
  دستور: پاک‌کردن `node_modules/.pnpm/@prisma+client@*/node_modules/.prisma` + rebuild کامل
  نتیجه: بدون آن پاک‌سازی، `enums.test.ts` محلی سبز می‌ماند؛ با آن، همان شکست واقعی CI (`Cannot find module '.prisma/client/default'`) محلی هم بازتولید شد

- **PR #۱۷ (هات‌فیکس P0) از مسیر عادی (بدون `--admin`) merge شد** _(۲۰۲۶-۰۸-۲۳)_
  دستور: `gh pr view 17 --json state,mergedAt,mergeCommit`
  نتیجه: `{"mergeCommit":{"oid":"afa8c4188482910aaebd17a41c94aa94bf47cab6"},"mergedAt":"2026-08-23T12:01:19Z","state":"MERGED"}`

- **PR #۱۶ (برش عمودی فاز ۵) بعد از rebase روی #۱۷ و سبز شدن مجدد CI، از مسیر عادی merge شد** _(۲۰۲۶-۰۸-۲۳)_
  دستور: `gh pr view 16 --json state,mergedAt,mergeCommit`
  نتیجه: `{"mergeCommit":{"oid":"453fc3c4870fb01c05943e7cc264d4d9f9f3ea30"},"mergedAt":"2026-08-23T12:17:04Z","state":"MERGED"}`

- **`main` بعد از هر دو merge (`453fc3c` روی `afa8c41`) با Postgres/Redis واقعی محلی کامل سبز است** _(۲۰۲۶-۰۸-۲۳)_
  دستور: `git checkout main && git pull` سپس `pnpm install/build/typecheck/lint/test` با `DATABASE_URL`/`REDIS_URL`/اسرار صادرشده مطابق `ci.yml`
  نتیجه: build/typecheck/lint: `Tasks: 8 successful, 8 total` هرکدام؛ test: `Test Suites: 42 passed, 42 total` `Tests: 284 passed, 284 total`

---

## وضعیت فازها

| فاز                | وضعیت           | توضیحات                                                                             |
| ------------------ | --------------- | ----------------------------------------------------------------------------------- |
| ۰ — پایه           | ✅ تکمیل‌شده    | Bootstrap monorepo                                                                  |
| ۱ — دیتابیس        | ✅ تکمیل‌شده    | Prisma + migration + seed                                                           |
| ۲ — احراز هویت     | ✅ تکمیل‌شده    | OTP + JWT + rate limit                                                              |
| ۳ — پروفایل کاربر  | ✅ تکمیل‌شده    | پروفایل + مهارت‌ها + دسته‌ها + آواتار                                               |
| ۴ — سیستم طراحی    | 🔄 در حال انجام | زیرساخت (Tailwind v4 + Vazirmatn + shadcn/ui) برقرار؛ کامپوننت‌های بیشتر ادامه دارد |
| ۵ — درخواست‌ها     | 🔄 در حال انجام | برش اول (create+publish+list عمومی) کامل؛ ویرایش/حذف و صفحه‌ی فرم ساخت در PR بعدی   |
| ۶ — AI             | ⏳ در انتظار    | AI wizard + live preview                                                            |
| ۷ — پیشنهادها      | ⏳ در انتظار    | Offers + selection flow                                                             |
| ۸ — چت             | ⏳ در انتظار    | Socket.IO + conversations                                                           |
| ۹ — پرداخت         | ⏳ در انتظار    | Zarinpal + entitlements                                                             |
| ۱۰ — تکمیل تجربه   | ⏳ در انتظار    | Reviews + PWA + SEO                                                                 |
| ۱۱ — کیفیت و تحویل | ⏳ در انتظار    | E2E tests + security + docker                                                       |

> **یادداشت شماره‌گذاری:** فاز «پروفایل کاربر» (که پیش‌تر در برنامه اصلی فاز ۳ = سیستم طراحی بود) بنا به تصمیم صریح کاربر جلوتر انداخته و فاز ۳ واقعی شد؛ فازهای ۳ تا ۱۰ قبلی یک واحد به عقب رانده شدند (اکنون ۴ تا ۱۱). ارجاعات قدیمی‌تر در این فایل به «فاز ۱۰» برای بدهی فنی، به فاز ۱۱ جدید اشاره دارند.

---

## یادداشت‌های فازهای تکمیل‌شده (۰ تا ۴)

جزئیات کامل هر فاز (تصمیمات، باگ‌های واقعی کشف‌شده، تست‌ها، اثبات‌های زنده) به
`docs/phase-history/` منتقل شد تا فایل اصلی برای فازهای فعلی/آینده سبک بماند. این
فازها همگی **تکمیل‌شده** هستند — محتوای زیر فقط پوینتر است، نه خلاصه.

- **فاز ۰ — بوت‌استرپ:** `docs/phase-history/phase-0.md`
- **فاز ۱ — دیتابیس:** `docs/phase-history/phase-1.md`
- **فاز ۲ — احراز هویت:** `docs/phase-history/phase-2.md`
- **فاز ۳ — پروفایل کاربر:** `docs/phase-history/phase-3.md`
- **فاز ۴ — سیستم طراحی (زیرساخت shadcn/ui):** `docs/phase-history/phase-4.md`

---

## یادداشت‌های فاز فعلی (فاز ۵) — برش عمودی اول: ساخت + انتشار + فهرست عمومی

### دامنه‌ی این PR (اولین برش عمودی، تعمداً کوچک)

طبق تصمیم صریح در بازبینی: یک جریان واحد، نه چند اندپوینت پراکنده. کاربر تأییدشده یک
درخواست DRAFT می‌سازد، منتشرش می‌کند، و در فهرست عمومی (با بودجه‌ی همیشه ماسک‌شده) دیده
می‌شود. ویرایش/حذف، صفحه‌ی فرم ساخت در `apps/web`، و auth plumbing سمت وب عمداً به PR دوم
موکول شدند.

- **Prisma:** بدون migration — مدل `Request`/`RequestSkill` از فاز ۱ کامل بود.
- **Backend:** `apps/api/src/requests/` — `RequestsController` (`@Post` بدون بدنه = ساخت،
  `@Post('publish')`، `@Post('list')` عمومی) → `RequestsService` (بدون لایه‌ی Manager/Repository
  جدا؛ همان الگوی `categories`/`users` موجود در این ریپو: سرویس مستقیم از `prisma` singleton
  در `@vaqt/db` استفاده می‌کند). `id` همیشه در body پاس می‌شود، نه query/path.
- **Schema:** `packages/shared/src/schemas/request.ts` — `createRequestSchema` (با
  `.refine` برای `budgetMaxRial >= budgetMinRial`)، `publishRequestSchema`، `listRequestsSchema`
  — ۱۴ تست، پوشش ۱۰۰٪.
- **گاردها:** `create()` و `publish()` هر دو `@RequireVerifiedPhone()` دارند (تصمیم محصولی
  صریح این بازبینی: هم ساخت هم انتشار نیاز به تأیید شماره دارند، برخلاف پیشنهاد اولیه‌ی من
  که فقط publish را نیاز داشت). `publish()` علاوه‌براین `@RequireOwnership()` دارد — اولین
  مصرف واقعی این گارد در کل پروژه (تا این PR فقط تعریف شده بود، هیچ روتی از آن استفاده
  نمی‌کرد).
- **خطای فارسی جدید:** `ErrorCode.REQUEST_NOT_DRAFT` → «فقط درخواست‌های پیش‌نویس را می‌توان
  منتشر کرد.» (۴۰۹).
- **`publish()`:** `listTier`/`listRankAt` صریحاً ست می‌شوند (نه تکیه بر default ستون) —
  `listTier = 0` (تنها tier موجود در v1، چون urgent/featured هنوز پیاده نشده)، `listRankAt = publishedAt`.

### دو باگ واقعی که فقط با اجرای زنده (curl روی سرور واقعی) کشف شدند

هیچ‌کدام با تست واحد/typecheck/lint قابل کشف نبودند — چون **هیچ تستی در کل این ریپو، برای
هیچ کنترلری، بوت واقعی از طریق `main.ts` را با HTTP واقعی امتحان نمی‌کند** (کنترلر-تست‌های
موجود مثل `users.controller.spec.ts` مستقیماً متد کلاس را صدا می‌زنند، بدون عبور از هیچ
Guard/Pipe/Filter واقعی). این خودش یک شکاف تست است، ثبت‌شده به‌عنوان درسِ این بازبینی، نه یک
بدهی جدید در جدول (چون رفع آن — افزودن یک لایه‌ی تست e2e واقعی — فراتر از scope این PR است).

1. **`app.useGlobalPipes(new ValidationPipe({whitelist, forbidNonWhitelisted}))` در `main.ts`
   هر روت مبتنی‌بر zod را می‌شکست.** این کلاس-validator pipe سراسری بود، در حالی که
   `CreateRequestDto`/`UpdateUserProfileDto`/... (همه‌ی DTOهای فاز ۳ به بعد) هیچ دکوریتور
   class-validator ندارند (طبق تصمیم مستند در همین فایل: «schema-اول... نه مانی‌فست global»).
   با `whitelist:true`، هر فیلد بدون دکوریتور class-validator "ناشناخته" تلقی و حذف می‌شود؛
   با `forbidNonWhitelisted:true` همان حذف باعث 400 می‌شود. یعنی از فاز ۳ به بعد، **هیچ
   اندپوینت zod-محور این پروژه هرگز واقعاً روی سرور بوت‌شده کار نمی‌کرد** — فقط چون هیچ‌کس
   قبلاً curl واقعی روی آن‌ها نزده بود، کشف نشده بود. تنها `AuthController` واقعاً به این
   pipe سراسری نیاز داشت (سه DTO قدیمی‌تر از فاز ۲: `RequestOtpDto`/`VerifyOtpDto`/`UpdateRoleDto`
   هنوز class-validator هستند). رفع: `useGlobalPipes` از `main.ts` حذف شد؛
   `@UsePipes(new ValidationPipe(...))` به‌جایش روی خودِ کلاس `AuthController` گذاشته شد
   (scope شد، نه حذف رفتار). تأیید زنده: `PATCH /users/me` بعد از رفع، واقعاً به Prisma رسید
   (قبلش هرگز نمی‌رسید).
2. **`@UsePipes()` سطح متد وقتی هم `@CurrentUser()` هم `@Body()` در یک متد باشند، pipe را
   روی هر دو پارامتر resolve‌شده اجرا می‌کند، نه فقط `@Body()`.** `create()` این ترکیب را
   داشت؛ `publish()`/`list()` فقط `@Body()` داشتند و به همین دلیل این باگ را نشان نمی‌دادند.
   نتیجه‌ی مشاهده‌شده: بدنه‌ی واقعی curl (که در سطح Guard با `console.error` موقت تأیید شد
   کاملاً درست می‌رسد) وقتی به Pipe می‌رسید، انگار کاملاً خالی بود — هر فیلد «Required»،
   دقیقاً مثل تست دستی pipe با ورودی `{}`. رفع: `ZodValidationPipe` از سطح متد
   (`@UsePipes`) به سطح پارامتر منتقل شد (`@Body(new ZodValidationPipe(CreateRequestDto))`)
   برای هر سه اندپوینت (برای یکدستی، نه فقط `create` که واقعاً می‌شکست).

**نکته‌ی جانبی، هنگام دیباگ کشف شد، عمداً در همین PR رفع نشد ولی به جدول «بدهی فنی» اضافه
شد (ردیف چهارم جدید):** `AllExceptionsFilter` برای هر `HttpException` غیر-`AppError` (نه فقط
خطاهای اعتبارسنجی واقعی) کد را بی‌قیدوشرط `VALIDATION_ERROR` می‌گذارد و فقط `body.message`
را می‌خواند، نه فیلد `errors` که `nestjs-zod` واقعاً جزئیات هر فیلد را در آن برمی‌گرداند —
یعنی خطای اعتبارسنجی همیشه پیام عمومی «Validation failed» را نشان می‌دهد، بدون فهرست
فیلدهای خراب. برای دیباگ همین PR یک `console.error` موقت اضافه و بعد از پیدا کردن ریشه‌ی
مشکل حذف شد.

### تست

۱۰ تست جدید در `apps/api/src/requests/requests.service.spec.ts` (روی Postgres واقعی):
`create()` (DRAFT + `searchText` از `normalizeFa`، رد دسته‌ی ناموجود/غیرفعال)، `publish()`
(انتقال وضعیت + `listTier`/`listRankAt` صریح، رد انتشار مجدد با `REQUEST_NOT_DRAFT`، رد
درخواست ناموجود)، `list()` (**تست منفی واقعی روی رشته‌ی JSON** برای masking — نه فقط چک
`null` بودن فیلد؛ **تست pagination با ۵ ردیف هم‌رتبه** روی دقیقاً یک `(listTier, listRankAt)`
که ثابت می‌کند کرسر هیچ ردیفی را جا نمی‌اندازد و تکرار نمی‌کند؛ رد DRAFT از فهرست عمومی؛
resolve صحیح `categoryName`/`ownerDisplayName`). ۱۴ تست schema در
`packages/shared/src/schemas/request.test.ts` (پوشش ۱۰۰٪). `public-routes.spec.ts` به‌روز شد
(`RequestsController` + `POST /requests/list` در allowlist). کل `pnpm test` از ریشه (با
`DATABASE_URL`/`REDIS_URL` صادرشده در همان دستور): **۸/۸ تسک سبز، ۲۹۲ تست.**

### اثبات ادعای ایندکس (`EXPLAIN ANALYZE`)

جزئیات کامل در جدول «بدهی فنی» بالا (ردیف ایندکس مرکب). خلاصه: صفحه‌ی اول کاملاً کارآمد
(`Index Scan Backward`، بدون migration طبق قاعده‌ی تصمیم‌گیری)؛ صفحه‌های عمیق‌تر با cursor
از نظر فنی هنوز «Index Scan» هستند ولی با `Filter` نه `Index Cond` ارزیابی می‌شوند (کند در
مقیاس بزرگ) — یک محدودیت query-shape که `prisma.$queryRaw` می‌تواند حل کند، عمداً در این
PR انجام نشد.

### فرانت‌اند

`apps/web/src/app/requests/page.tsx` — Server Component، `fetch` مستقیم سمت سرور به
`NEXT_PUBLIC_API_URL` (بدون dependency جدید: نه axios، نه swr/react-query، طبق دستور
صریح)، مصرف کامپوننت موجود `RequestCard` (بدون تغییر — shape پاسخ `RequestsService.list()`
دقیقاً با `RequestCardData` مطابق است). حالت خالی/خطا با `Empty` موجود از `packages/ui`.
لینک ناوبری `/requests` در `AppShell` اضافه شد (رشته‌ی `fa.appShell.nav.requests` از قبل
برای همین منظور رزرو شده بود، مصرف نشده بود). `pnpm --filter @vaqt/web build`: مسیر
`/requests` به‌درستی `ƒ (Dynamic)` است (چون `cache: 'no-store'`)، ۱۸۸ کیلوبایت.

### اثبات زنده (curl روی سرور واقعی، Postgres/Redis واقعی)

جریان کامل هفت‌مرحله‌ای (شماره‌ی تصادفی جدید، OTP از لاگ سرور، همه‌چیز پاک‌سازی‌شده بعد از
اجرا — seed به شمارش اولیه‌اش برگشت):

1. `POST /auth/otp/request` → `{"ok":true,...}`
2. `POST /auth/otp/verify` → کوکی session + `phoneVerified:true`
3. `POST /requests` (create) → `{"id":"...","status":"DRAFT"}`
4. `POST /requests/publish` → `{"id":"...","status":"PUBLISHED","publishedAt":"..."}`
5. `POST /requests/list` (بدون auth) → درخواست تازه در فهرست دیده شد؛ `grep` روی رشته‌ی خام
   JSON برای ارقام بودجه‌ی واقعی (`4990000`/`7770000`) صفر نتیجه داد
6. `POST /requests/publish` دوباره روی همان id → `HTTP 409` +
   `{"code":"REQUEST_NOT_DRAFT","message":"فقط درخواست‌های پیش‌نویس را می‌توان منتشر کرد."}`
7. `UPDATE users SET "phoneVerifiedAt" = NULL` مستقیم در Postgres (شبیه‌سازی لغو تأیید، همان
   الگوی فاز ۲) + `POST /requests` دوباره با همان کوکی → `HTTP 403` +
   `{"code":"PHONE_NOT_VERIFIED",...}`

### باقی‌مانده برای فاز ۵

ویرایش/حذف درخواست، صفحه‌ی فرم ساخت در `apps/web` (auth plumbing سمت وب — PR دوم)، فیلترهای
فهرست (دسته/mode/شهر/جست‌وجو — بند ۶ اسپک اجازه می‌دهد، این برش عمداً بدون فیلتر ساخته شد)،
مهارت‌های درخواست (`RequestSkill`، عمداً از این برش حذف شد)، صفحه‌ی جزئیات درخواست (تنها جایی
که بودجه‌ی واقعی برای کاربر تأییدشده نمایش داده می‌شود).
