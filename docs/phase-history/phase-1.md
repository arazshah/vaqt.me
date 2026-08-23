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
