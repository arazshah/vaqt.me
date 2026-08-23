## یادداشت‌های فاز ۰

- monorepo با pnpm workspaces و turborepo راه‌اندازی و تأیید شد
- تنظیمات پایه برای توسعه (ESLint, Prettier, Husky, Commitlint) فعال و بدون خطا
- زیرساخت dev با Docker Compose (postgres سالم؛ redis روی این ماشین با یک سرویس محلی دیگر روی پورت ۶۳۷۹ تداخل داشت — با تغییر مپ پورت به `6380:6379` و به‌روزرسانی `REDIS_URL` رفع شد)
- `turbo.json`: تسک `typecheck` (و `lint`/`build`) به `^build` وابسته است؛ چون Prisma Client خروجی خودِ پکیج `@vaqt/db` است نه یکی از وابستگی‌هایش، override اختصاصی `@vaqt/db#typecheck` (و `#lint`, `#test`) اضافه شد تا `prisma generate` قبل از typecheck خودِ همان پکیج هم اجرا شود. با `git clean -xdf && pnpm install && pnpm typecheck` تأیید شد. **به‌روزرسانی فاز ۲:** این معماری بعداً به `generate` (تسک واقعی و مستقل، نه `build`) منتقل شد — به یادداشت فاز ۲ مراجعه شود.
- فایل‌های config محیط توسعه (.nvmrc, .editorconfig, .vscode)
- `pnpm install` + `lint` + `typecheck` + `build` + `test` روی هر ۵ workspace (api, web, db, shared, ui) سبز
- اسکیمای Prisma placeholder با موفقیت migrate و seed شد در دیتابیس واقعی

---
