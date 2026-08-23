## یادداشت‌های فاز فعلی (فاز ۴) — زیرساخت shadcn/ui، در حال انجام

### وضعیتی که این بخش پیدا شد

یک `shadcn init` قبلاً به‌صورت uncommitted مستقیماً داخل `apps/web` اجرا شده بود (aliases روی `@/components`، `rtl: false`) — که با تصمیم بند ۱ («کامپوننت‌ها در `packages/ui`») در تضاد بود. چون هنوز هیچ کامپوننتی واقعاً اضافه نشده بود، جای امنی برای اصلاح مسیر بود؛ کل کار در `apps/web` ابتدا با `git stash` کنار گذاشته شد و از نو، این‌بار روی `packages/ui`، انجام شد. (آن stash بعداً از دست رفت — نه در `git stash list` بود و نه در reflog؛ چون محتوایش هیچ‌وقت در هیچ کامیتی استفاده نشد، بسته شد، غیرمسدودکننده — بازبینی ۲۰۲۶-۰۸-۲۱.)

### باگ واقعی که فقط با اجرای زنده کشف شد: عدم تطابق Tailwind v3/v4

نسخه‌ی نصب‌شده‌ی `shadcn` (`4.18.0`) فقط CSS مخصوص Tailwind **v4** تولید می‌کند (`@theme inline`, `@custom-variant`) ولی `apps/web` تا این لحظه روی Tailwind **v3.4** بود. این ناسازگاری با خواندن package.json دیده نمی‌شد؛ فقط وقتی خروجی واقعی `globals.css` بررسی شد (شامل at-rule های v4-only) و بعد `next build` روی v3 اجرا شد، مشخص شد که `bg-background`/`border-border`/`outline-ring` هیچ کدام یک utility واقعی تولید نمی‌کنند (چون v3 برای این، نیاز به `theme.colors` صریح دارد، نه یک CSS custom property دلخواه). **تصمیم:** ارتقا به Tailwind v4 (`tailwindcss@^4.3.3` + `@tailwindcss/postcss`، بدون `autoprefixer` که دیگر لازم نیست).

**پنج تأیید زنده روی خروجی کامپایل‌شده‌ی واقعی (۲۰۲۶-۰۸-۲۱، `pnpm --filter @vaqt/web build` با `.next` کاملاً پاک‌شده، سپس `grep` روی `apps/web/.next/static/css/*.css`):**

1. **بدون تصادم `border`/`ring`:** `.border-border{border-color:var(--border)}` (توکن معنایی shadcn) و `.text-brand-900{color:#2e2547}` (رنگ برند، بعد از rename به `brandBorder`) هر دو مستقل و درست کامپایل می‌شوند؛ `outline-ring:focus-visible{outline-color:var(--ring)}` هم حاضر است.
2. **`@theme inline` واقعاً اثر دارد:** خروجی کامپایل‌شده شامل `--color-border:var(--border)` است — یعنی نگاشت semantic-token-به-CSS-var بلوک `@theme inline` در `packages/ui/src/styles/globals.css` واقعاً در CSS نهایی جاری شده، نه فقط در منبع باقی مانده.
3. **`tw-animate-css` بارگذاری شده:** utility های `animate-in`/`animate-out` این پکیج در CSS کامپایل‌شده حضور دارند.
4. **هدف مرورگر مشخص و مستند شد (قبلاً هیچ‌جا ثبت نشده بود):** Tailwind v4 خودش بدون هیچ polyfill به ویژگی‌های مدرن CSS (cascade layers بومی، `@property`، `color-mix()`) متکی است و طبق مستندات رسمی حداقل نسخه‌های Safari 16.4 / Chrome 111 / Firefox 128 را هدف می‌گیرد. این حداقل به‌صورت صریح در `apps/web/package.json` (`"browserslist": ["safari >= 16.4", "chrome >= 111", "firefox >= 128"]`) ثبت شد تا هم مستند باشد و هم ابزارهایی مثل SWC/Next که به `browserslist` نگاه می‌کنند همین هدف را ببینند.
5. **Vazirmatn واقعاً self-host است:** `@font-face{font-family:vazirmatn;src:url(/_next/static/media/41c9fb9084869680-s.p.woff2) format("woff2");font-display:swap}` — مسیر `url()` به یک فایل استاتیک محلی زیر `/_next/static/media/` اشاره می‌کند؛ `grep -c "fonts.googleapis\|fonts.gstatic"` روی همان فایل CSS نتیجه‌ی `0` داد.

### معماری مونوریپو shadcn/ui (تأیید شده با اجرای واقعی CLI، نه فقط خواندن مستندات)

- `packages/ui/package.json` یک فیلد `exports` واقعی گرفت (`./components/*` → `./src/components/*.tsx`, `./lib/*` → `./src/lib/*.ts`, `./hooks/*` → `./src/hooks/*.ts`, `./styles/*` → `./src/styles/*`) — این فیلد صرفاً برای اپ نیست؛ خودِ CLI برای resolve کردن alias های cross-package (`@vaqt/ui/components/ui` و…) دقیقاً از همین exports map استفاده می‌کند (دیدنِ سورس واقعی بسته‌ی نصب‌شده در `node_modules/.pnpm/shadcn@4.18.0.../dist/chunk-2CD4IZV7.js` این را تأیید کرد؛ حدس اولیه بر پایه‌ی docs قدیمی‌تر اشتباه از آب درآمد).
- **هر دو طرف** به `components.json` نیاز دارند: هم `apps/web/components.json` (چون فقط آنجا next.config شناسایی می‌شود و CLI framework را تشخیص می‌دهد) و هم `packages/ui/components.json` (چون CLI هنگام عبور از مرز پکیج، «workspace config» مقصد را هم می‌خواهد؛ بدون آن با خطای صریح شکست می‌خورد). در `apps/web/components.json` تمام aliases (`components`, `ui`, `lib`, `hooks`, `utils`) به `@vaqt/ui/...` تغییر کردند؛ در `packages/ui/components.json` همان مقادیر به‌صورت self-referencing تکرار شدند.
- روش واقعی افزودن کامپوننت (تأیید شده با افزودن واقعی `button`):
  ```
  pnpm --filter @vaqt/ui exec shadcn add <name> -c ../../apps/web -y
  ```
  (نه از `apps/web` — چون بستهٔ `shadcn` فقط dependency خودِ `packages/ui` است، نه `apps/web`.) کامپوننت مستقیماً در `packages/ui/src/components/ui/<name>.tsx` نوشته می‌شود؛ apps/web آن را با `import { X } from '@vaqt/ui/components/ui/x'` مصرف می‌کند (deep import، نه از طریق barrel — همان الگویی که خودِ فایل تولیدشده هم برای `cn` از `@vaqt/ui/lib/utils` استفاده می‌کند).
- `packages/ui/src/index.ts` فقط برای موارد دستی/مشترک (نه کامپوننت‌های تولیدشده‌ی CLI) استفاده می‌شود: `cn` و `DirectionProvider` (از `@radix-ui/react-direction`، re-export شده تا `apps/web` مستقیماً به radix وابسته نباشد).

### RTL

`--rtl` هنگام init پاس داده شد (`"rtl": true` در هر دو `components.json`). این صرفاً metadata تزئینی نیست: کامپوننت تولیدشده‌ی واقعی (`button.tsx`) خودش از یوتیلیتی‌های منطقی Tailwind استفاده می‌کند (`ps-2`/`pe-2`، نه `pl-2`/`pr-2`) — یعنی الزام بند ۱ همین فایل را خودِ رجیستری shadcn هم رعایت می‌کند، بدون نیاز به دست‌کاری دستی. علاوه بر آن، `<DirectionProvider dir="rtl">` در `apps/web/src/app/layout.tsx` کل درخت را می‌پیچد (در کنار `<html dir="rtl">` که از قبل بود).

**رفع بدهی (بسته‌ی بعدی، همین فاز):** قاعده‌ی ESLint سفارشی `local/no-physical-tailwind-classes` نوشته شد (`eslint-rules/no-physical-tailwind-classes.mjs`) — روی هر `Literal`/`TemplateElement` رشته‌ای که در یک attribute با نام `className`/`class` یا در آرگومان فراخوانی `cn`/`clsx`/`cva`/`cx`/`classnames`/`twMerge`/`twJoin`/`tv` قرار دارد، هر token را جدا بررسی می‌کند و `pl-`/`pr-`/`ml-`/`mr-`/`left-`/`right-`/`text-left`/`text-right`/`border-l`/`border-r`/`rounded-l`/`rounded-r`/`float-left`/`float-right`/`clear-left`/`clear-right` (با پیشوندهای variant مثل `md:`/`hover:`/`dark:` و علامت منفی `-ml-2`) را رد می‌کند؛ کلاس‌های واقعی مثل `rounded-lg`/`border-red-500`/`border-rose-200` را با یک lookahead روی مرز token اشتباه نمی‌گیرد (۱۹ تست RuleTester). محدودیت مستند: چون بدون type-info است، مقادیر کاملاً دینامیک (`className={x}`) و CSS دلخواه مثل `[padding-left:10px]` را نمی‌بیند.

- **apps/web از `.eslintrc.json` به `eslint.config.mjs` (flat config) مهاجرت کرد** — نه صرفاً برای این قاعده، بلکه چون `next lint` هم اکنون (خروجی واقعی build) صراحتاً اعلام می‌کند در Next.js 16 حذف می‌شود؛ `next/core-web-vitals`+`next/typescript` با `FlatCompat` از `@eslint/eslintrc` (که به‌عنوان devDependency مستقیم اضافه شد، نه phantom) پل زده شدند. بدون این مهاجرت، قاعده‌ی جدید فقط روی `packages/ui` اثر می‌کرد، نه روی کد واقعی apps/web که بیشترین استفاده‌ی `className` در آن اتفاق می‌افتد.
- در `packages/ui`، قاعده روی `src/**/*.tsx` با `ignores: ['packages/ui/src/components/ui/**']` اعمال شد — چون آن پوشه محصول `shadcn add` است (vendor، نه دست‌نویس) و هر ۱۷ کامپوننت فعلی از قبل روی همین قاعده تست و تأیید سبز شدند.
- تأیید زنده (نه فقط unit test): یک `pl-4` موقت در `apps/web/src/app/page.tsx` تزریق شد، `next lint` واقعاً خطا داد (`Physical Tailwind utility "pl-4" is banned...`)، سپس فایل به حالت اول برگشت و `pnpm lint` دوباره سبز شد.

### فونت Vazirmatn

`apps/web/src/lib/fonts.ts` با `next/font/local` از `public/fonts/Vazirmatn-Variable.woff2` (که از قبل، جدا از این فاز، در پوشه بود) با `display: 'swap'` بارگذاری می‌شود؛ متغیر CSS آن (`--font-vazirmatn`) در `packages/ui/src/styles/globals.css` روی `--font-sans` shadcn نگاشت شده. **باگ واقعی که init به‌صورت پیش‌فرض تولید کرده بود:** یک بار با `Geist` از `next/font/google` (نقض صریح «بدون هیچ درخواست به CDN» در بند ۲) و یک بار (در تلاش دستی قبلی) با یک تعریف خودارجاع (`--font-sans: var(--font-sans)`، یک no-op) — هر دو با اجرای واقعی build و بررسی CSS کامپایل‌شده (`@font-face` با `src: url(...)` محلی، نه گوگل) کشف و رفع شدند.

### تقسیم CSS بین packages/ui و apps/web

- `packages/ui/src/styles/globals.css`: importهای `tw-animate-css`/`shadcn/tailwind.css`، `@custom-variant dark`، توکن‌های `:root`/`.dark`، و بلوک `@theme inline` (نگاشت رنگ‌های معنایی shadcn). `apps/web/src/app/globals.css` این را با `@import "@vaqt/ui/styles/globals.css";` وارد می‌کند (resolve از طریق همان `exports` بالا، نه مسیر نسبی).
- تم/رنگ‌های برند قدیمی (`apps/web/tailwind.config.ts`، از فاز ۰) با دایرکتیو `@config "../../tailwind.config.ts";` (پل رسمی v4 برای پیکربندی JS قدیمی) نگه داشته شدند — نه با بازنویسی به `@theme` CSS، تا کار فاز ۰ حفظ شود.
- **تضاد نام واقعی که کشف شد:** `theme.extend.colors.border` (برند، از فاز ۰) دقیقاً با `--color-border` معنایی shadcn برخورد داشت (هر دو تولید `border-border` می‌کردند). با بررسی CSS کامپایل‌شده (`grep` روی خروجی build) تأیید شد و با تغییر نام برند به `brandBorder` رفع شد. تست زنده‌ی بعدی تأیید کرد `.border-border{border-color:var(--border)}` (توکن shadcn) و `.text-brand-900{color:#2e2547}` (برند) هر دو درست و بدون تداخل کامپایل می‌شوند.

### تأیید زنده

`pnpm --filter @vaqt/web build` با یک `Button` واقعی (اضافه‌شده با CLI، نه دست‌نویس) در `page.tsx` اجرا و خروجی HTML واقعی (`.next/server/app/index.html`) بازرسی شد: `<html lang="fa" dir="rtl" class="__variable_d64fe9">`، `<button>` با کلاس‌های `radix-nova` (شامل `ps-2`/`pe-2` منطقی)، و `@font-face` با `src` محلی به فایل woff2 واقعی — نه فراخوانی گوگل. `pnpm lint`/`pnpm typecheck`/`pnpm test` روی هر ۵ workspace (بجز شکست‌های تست `apps/api` که به نبود `DATABASE_URL`/Postgres واقعی در این محیط مربوط است، نه به این فاز) سبز.

### دسته‌ی دوم کامپوننت‌ها

با همان دستور (`pnpm --filter @vaqt/ui exec shadcn add <names...> -c ../../apps/web -y`) ۱۶ کامپوننت پایه‌ی دیگر اضافه شد: `card`, `input`, `label`, `textarea`, `select`, `badge`, `avatar`, `dialog`, `dropdown-menu`, `separator`, `tabs`, `skeleton`, `tooltip`, `checkbox`, `switch`, `sonner` — انتخاب‌شده چون فازهای ۵ تا ۹ (فرم درخواست، لیست پیشنهادها، چت، تسویه) همگی به این پرایمیتیوها نیاز دارند.

- کامپوننت `sonner` خودش دو وابستگی جدید (`sonner`, `next-themes`) به `packages/ui` اضافه کرد (به‌صورت خودکار توسط CLI، نه دستی).
- `TooltipProvider` طبق دستور صریح خروجی CLI («Remember to wrap your app with the TooltipProvider component») در `apps/web/src/app/layout.tsx` دور کل درخت پیچیده شد؛ `<Toaster />` هم همان‌جا mount شد تا `toast()` در هر نقطه از اپ در فازهای بعد قابل استفاده باشد.
- **تصمیم عمداً گرفته‌نشده (در زمان نوشتن این بند):** `next-themes`ی که با `sonner` آمد را به یک `ThemeProvider` واقعی (تاگل روشن/تاریک) وصل نکردیم — چون این فایل هنوز هیچ تصمیمی درباره‌ی حالت تاریک ندارد و آن یک تصمیم محصولی جداست، نه یک نیاز فنی برای کامپایل شدن. بدون `ThemeProvider`، `useTheme()` داخل `sonner.tsx` به‌صورت امن روی مقدار پیش‌فرض «system» می‌افتاد (چون `next-themes` یک context پیش‌فرض معتبر دارد، نه throw/undefined) — یعنی چیزی نمی‌شکست، فقط تاگل واقعی هنوز وجود نداشت. **به‌روزرسانی بعدی:** چون این وابستگی هرگز واقعاً به یک `ThemeProvider` وصل نشد، بعداً کاملاً حذف شد — به بند «حالت تاریک» در جدول «بدهی فنی» مراجعه شود.
- تأیید زنده: `page.tsx` موقتاً با ترکیب واقعی `Card`+`Badge`+`Input`+`Label`+`Tooltip` بازنویسی و build شد؛ خروجی HTML واقعی بررسی شد (`data-slot="badge"`/`"card"`، `<label>`، و regex برای اطمینان از نبود هیچ کلاس فیزیکی `pl-`/`pr-`/`ml-`/`mr-` در نشانه‌گذاری تولیدشده — نتیجه: صفر).

### بستن هفت پیش‌نیاز فاز ۴ (بازبینی مجزا، پیش از ادامه‌ی کار طراحی)

هفت مورد پیش‌نیاز صریح فاز ۴ بررسی شد. شش مورد از قبل (در پایان فاز ۳) واقعاً پیاده‌سازی شده بودند؛ با اجرای واقعی (نه فقط خواندن کد) تأیید و بند باز هفتم (شماره‌گذاری برنچ/تگ) تکمیل شد:

1. **جداسازی `toPublicUser`/`toPrivateUser`:** بررسی کد نشان داد این کار از پایان فاز ۳ کامل انجام شده بود (`apps/api/src/auth/user-view.ts`) — دقیقاً طبق اسپک (`maskedPhone`, `phoneVerified: boolean`, `status`, `systemRole`, `completeness`؛ `roleIntent` از قبل روی `PublicUser` پایه بود که `PrivateUser` آن را به ارث می‌برد، همان چیزی که اسپک «intentRole» می‌نامید). قاعده‌ی `local/restrict-to-private-user` هم از قبل call site را به دو فایل مجاز محدود می‌کرد. چیزی برای تغییر نبود؛ فقط با اجرای `pnpm test` واقعی دوباره تأیید شد.
2. **CI:** workflow از قبل وجود داشت (Postgres 16 + Redis 7 service container، `migrate deploy`، سپس lint/typecheck/build/test) ولی **هرگز روی GitHub واقعاً اجرا نشده بود** (هیچ run ثبت‌شده‌ای نبود، چون commit حاوی آن هنوز push نشده بود). با push کردن، یک باگ واقعی کشف شد (به‌پایین مراجعه شود) و پس از رفع آن، CI روی یک checkout کاملاً تازه سبز شد.
3. **`master` → `main` + تگ‌های annotated:** برنچ پیش‌فرض با `gh api` به `main` تغییر کرد (بعد از push کردن و set‌کردن upstream)، `master` قدیمی از remote حذف شد. هر سه تگ فاز (`phase-0`, `phase-1`, `phase-2`) که lightweight بودند، حذف و با همان پیام کامیت و روی همان commit SHA به‌صورت annotated (`git tag -a`) بازسازی و دوباره push شدند (تأیید شد با `git for-each-ref --format='%(objecttype)'`: هر سه اکنون `tag` هستند، نه `commit`). سپس branch protection روی `main` با `required_status_checks.contexts: ["ci"]` + `enforce_admins: true` + `allow_force_pushes/deletions: false` فعال شد.
4. **تست دائمی قواعد ESLint:** از قبل کامل بود — `no-raw-user-return.test.mjs` (۴ تست، شامل حالت مستقیم، wrapper، و یک تست regression برای `PrivateUser` که نباید false-positive بدهد) و `restrict-to-private-user.test.mjs` (۵ تست). تنها مشکل این بود که این‌ها با یک اسکریپت جدا (`test:eslint-rules`) اجرا می‌شدند، نه از داخل `turbo run test` — رفع آن در بند بعد.
5. **بدهی `packages/shared`/`packages/db`:** از قبل رفع شده بود (تسق tsup، `dist` با CJS+ESM+d.ts، `apps/api` روی `nest start --watch`). برای `packages/ui` **عمداً همان کار انجام نشد** — تصمیم صریح کاربر: مشکلی که shared/db را مجبور به build کرد یک باگ واقعی بود (ts-node/esbuild در NestJS متادیتای decorator را درست emit نمی‌کرد)؛ `packages/ui` فقط توسط Next.js مصرف می‌شود که خودش TSX منبع را از workspace packages درست transpile می‌کند (در همین فاز ۴ با build واقعی اثبات شد)، پس آن باگ اصلاً وجود ندارد. Build کردن `packages/ui` با tsup هزینه‌ی واقعی داشت (حفظ `"use client"`, باندل CSS Tailwind، externalize کردن react) بدون رفع هیچ باگی، و با گردش‌کار خودِ `shadcn add` (که مستقیم در `packages/ui/src` می‌نویسد) در تضاد بود. **تصمیم نهایی: `packages/ui` عمداً source-only باقی می‌ماند** (`main: ./src/index.ts`، مصرف مستقیم TSX از طریق نگاشت `exports`)، برخلاف `shared`/`db` که به `dist` بیلد می‌شوند — این عدم‌تقارن آگاهانه است، نه بدهی فراموش‌شده.
   **قاعده‌ی مصرف پکیج‌ها (build شده در برابر source-only) — اثبات زنده، ۲۰۲۶-۰۸-۲۱:**

- `apps/web/next.config.ts` دارای `transpilePackages: ['@vaqt/ui', '@vaqt/shared']` است — یعنی Next.js صراحتاً هر دو را از TSX/TS منبع transpile می‌کند، نه از `dist`.
- برای اثبات اینکه typecheck واقعاً درون `packages/ui/src` را می‌بیند (نه فقط با یک fallback خاموش رد می‌شود)، یک خطای تایپ عمدی (`const x: number = 'not-a-number'`) موقتاً در `packages/ui/src/components/ui/button.tsx` تزریق شد. `pnpm --filter @vaqt/web typecheck` واقعاً شکست خورد و مسیر فایل را دقیقاً گزارش کرد: `../../packages/ui/src/components/ui/button.tsx(55,9): error TS2322: ...`. سپس فایل به حالت اول برگشت و typecheck دوباره سبز شد.
- **قاعده‌ی نهایی مصرف پکیج‌ها در این مونوریپو:**
  - **build شده به `dist` (tsup، CJS+ESM+d.ts):** هر پکیجی که یک **runtime غیر-bundler** (NestJS از طریق `ts-node --transpile-only`) مستقیماً آن را import می‌کند و به **decorator metadata** یا resolve دقیق CJS/ESM نیاز دارد. امروز این فقط `@vaqt/shared` و `@vaqt/db` هستند (مصرف‌کننده: `apps/api`).
  - **source-only (`main` به `src/index.ts`، مصرف با نگاشت `exports`):** هر پکیجی که فقط توسط یک **bundler واقعی** (Next.js/webpack، از طریق `transpilePackages`) مصرف می‌شود و نیازی به decorator metadata ندارد. امروز این فقط `@vaqt/ui` است (مصرف‌کننده: `apps/web`).
  - اگر روزی یک پکیج هم توسط `apps/api` و هم توسط `apps/web` مصرف شود، باید build شود (چون قید سخت‌گیرانه‌تر، یعنی NestJS، تعیین‌کننده است) — سناریویی که هنوز پیش نیامده.

6. **واحد پول:** از قبل رفع شده بود (`Offer.amountRial`, `Product.priceRial`, `Order.amountRial`, `Request.budgetMinRial`/`budgetMaxRial`, `moneyRialSchema` با ۸ تست). چیزی برای تغییر نبود.
7. **جدول self-audit:** الزام فرآیندی؛ نمونه‌ی آن در انتهای همین بخش آمده و از این پس در انتهای هر گزارش فاز تکرار می‌شود.

**تکمیلی (اضافه‌شده به لیست هفت‌موردی):** `eslint-rules/` به یک ۶مین workspace واقعی pnpm تبدیل شد (`eslint-rules/package.json` با اسکریپت `test`، اضافه‌شده به `pnpm-workspace.yaml`) تا هر دو قاعده‌ی سفارشی از طریق خودِ `turbo run test` اجرا شوند، نه یک اسکریپت ریشه‌ی جدا (`pnpm test` دیگر شامل `&& pnpm test:eslint-rules` نیست). تأیید شد: `pnpm test` اکنون «Packages in scope: … , eslint-rules» را نشان می‌دهد و هر ۶ سبز هستند.

**باگ واقعی که فقط با اجرای واقعی CI کشف شد (نه با اجرای محلی):** اولین push به `main` با CI واقعی fail شد — `@vaqt/db#lint` روی هر عضو enum وارد‌شده از `@vaqt/shared` در `seed.ts` خطای «type that cannot be resolved» می‌داد. علت: تسک‌های `lint` و `test` در `turbo.json` فقط به `^generate` وابسته بودند (که مخصوص Prisma است)، نه `^build` — پس `packages/shared/dist` (که فقط با `tsup build` ساخته می‌شود) در یک checkout کاملاً تازه هنوز وجود نداشت وقتی `@vaqt/db:lint` اجرا می‌شد. اجرای محلی همین مشکل را نشان نمی‌داد چون `dist/` از دستورهای قبلی همان نشست روی دیسک باقی مانده بود. رفع شد با اضافه‌کردن `^build` به `dependsOn` تسک‌های سراسری `lint` و `test` (و override های `@vaqt/db#lint`/`@vaqt/db#test`) در `turbo.json` — تأیید شد با پاک‌کردن دستی همه‌ی `dist/` و `.turbo/` (شبیه‌سازی واقعی یک checkout تازه) و سبز شدن دوباره‌ی `pnpm lint` و `pnpm test`، سپس با یک اجرای واقعی دوم روی GitHub Actions (`main` commit `eb8ed28`) که این‌بار سبز شد.

### باقیمانده برای تکمیل فاز ۴

کامپوننت‌های بیشتر (فرم‌ها، دیالوگ‌های پیچیده‌تر و…) طبق نیاز فازهای بعدی با همان دستور `shadcn add` اضافه خواهند شد؛ یک صفحه‌ی نمونه‌ی کامل‌تر برای دارک‌مود/تایپوگرافی و تصمیم محصولی درباره‌ی toggle حالت تاریک هنوز باز است. `next-themes` که هرگز به یک `ThemeProvider` وصل نشده بود کاملاً حذف شد (به بدهی فنی مراجعه شود)؛ اگر بعداً toggle واقعی ساخته شود، انتخاب کتابخانه باید دوباره بررسی شود، نه فرض گرفتن بازگشت خودکار `next-themes`.

### self-audit — بستن هفت پیش‌نیاز فاز ۴

| بند اسپک                                            | فایل/تست پیاده‌کننده                                                                                              | وضعیت                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| ۱. `toPublicUser`/`toPrivateUser` split             | `apps/api/src/auth/user-view.ts`; `eslint-rules/no-raw-user-return.test.mjs`, `restrict-to-private-user.test.mjs` | ✅ از قبل کامل (تأیید مجدد)                                         |
| ۲. CI روی Postgres/Redis واقعی، ۶ workspace         | `.github/workflows/ci.yml`; اجرای زنده `eb8ed28` (سبز)                                                            | ✅ تکمیل — بدون تست واحد (خودِ CI است)                              |
| ۳. `master`→`main`، تگ annotated، branch protection | مخزن GitHub (`gh api`)؛ بدون فایل کد                                                                              | ✅ تکمیل — **بدون تست خودکار** (اقدام یک‌باره‌ی زیرساختی)           |
| ۴. تست دائمی قواعد ESLint                           | `eslint-rules/no-raw-user-return.test.mjs` (۴)، `restrict-to-private-user.test.mjs` (۵)                           | ✅ از قبل کامل                                                      |
| ۵. بستن بدهی build (شامل تصمیم packages/ui)         | `packages/shared/tsup.config.ts`, `packages/db/tsup.config.ts`; این بخش CLAUDE.md برای تصمیم `packages/ui`        | ✅ تکمیل — بدون تست خودکار برای تصمیم معماری (مستندسازی است)        |
| ۶. واحد پول ریال                                    | `packages/shared/src/schemas/money.ts` (۸ تست)، `prisma/schema.prisma`                                            | ✅ از قبل کامل                                                      |
| ۷. جدول self-audit                                  | این جدول؛ بخش «الزامات باز» بالای فایل                                                                            | ✅ تکمیل — الزام فرآیندی                                            |
| تکمیلی: `eslint-rules` در تسک `test` توربو          | `eslint-rules/package.json`, `pnpm-workspace.yaml`, `package.json` (حذف `test:eslint-rules`)                      | ✅ تکمیل — تأیید با `pnpm test` (۶ workspace سبز)                   |
| باگ کشف‌شده: `lint`/`test` بدون `^build`            | `turbo.json`                                                                                                      | ✅ تکمیل — تأیید با شبیه‌سازی checkout تازه (محلی) + اجرای واقعی CI |
