# وقت من (vaqt.me)

کارت ویزیت آنلاین + رزرو وقت برای متخصصان. هر متخصص یک لینک (`vaqt.me/<username>`) و QR دارد؛
مراجعه‌کننده مخاطب را ذخیره می‌کند، با پیام‌رسان تماس می‌گیرد یا وقت رزرو می‌کند؛ متخصص در
ربات بله خبردار می‌شود و رزرو را تأیید یا رد می‌کند. رایگان و بدون ثبت‌نام جداگانه برای رزروکننده (تأیید با بله یا کد پیامکی).

## پشته

ثبت‌نام و ورود کاربران با شماره موبایل و کد پیامکی است. ورود با رمز عبور برای حساب‌های قدیمی و مدیر حفظ شده است. کاربران قدیمی می‌توانند شماره موبایل تأییدشده را از داشبورد به حساب خود متصل کنند. فعال‌سازی و تنظیم ارسال واقعی از `/admin/settings` انجام می‌شود.

pnpm + Turborepo · NestJS 10 · Next.js 15 (RTL، Tailwind v4، Vazirmatn) · Prisma + Postgres 16 ·
(صف و کش هم روی Postgres؛ Redis لازم نیست).

## اجرای محلی

```bash
nvm use && pnpm install
docker compose up -d                       # فقط Postgres
cp apps/api/.env.example apps/api/.env     # مقادیر را ست کنید
pnpm --filter @vaqt/db migrate:deploy && pnpm db:seed   # seed: کارت نمونه vaqt.me/demo
pnpm dev                                    # web:3000  api:3001
```

دروازه‌های کیفیت: `pnpm lint && pnpm typecheck && pnpm build && pnpm test`،
و E2E: `pnpm --filter @vaqt/web test:e2e`.

## استقرار

راهنمای کامل Coolify: [docs/DEPLOY-COOLIFY.md](./docs/DEPLOY-COOLIFY.md). همه‌ی تنظیمات
(پیامک، ربات بله، الگوها) از پنل `/admin/settings` انجام می‌شود، نه متغیر محیطی.

## مستندات فنی

قواعد و تصمیم‌های معماری: [CLAUDE.md](./CLAUDE.md).
