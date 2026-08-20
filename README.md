# Vaqt.me — بازار دقیقه‌های انسانی

> چند دقیقه از وقت یک آدمِ درست

**Vaqt.me** یک بازار دوطرفه (Marketplace) فارسی و راست‌چین برای خرید و فروش دقیقه‌های انسانی است. تفاوت بنیادین آن با سیستم‌های نوبت‌دهی متداول: پلتفرم فهرست متخصص ندارد. کاربر ابتدا نیاز خود را منتشر می‌کند و ارائه‌دهندگان برای آن نیاز پیشنهاد خصوصی می‌فرستند.

---

## پشته‌ی فناوری

- **ساختار:** Monorepo با pnpm workspaces + Turborepo
- **Backend:** NestJS 10 + TypeScript strict
- **Database:** Prisma + PostgreSQL 16
- **Cache/Queue:** Redis 7 + BullMQ
- **Frontend:** Next.js (App Router) + React + TypeScript strict
- **استایل:** TailwindCSS + shadcn/ui (کاملاً RTL)
- **فونت:** Vazirmatn (self-hosted)

---

## راه‌اندازی سریع

### پیش‌نیازها

- **Node.js:** 22 LTS (از nvm استفاده کنید: `nvm use`)
- **pnpm:** نسخه 9 یا بالاتر (`npm install -g pnpm`)
- **Docker:** برای اجرای PostgreSQL و Redis

### مراحل نصب

1. **کلون پروژه:**

   ```bash
   git clone https://github.com/arazshah/vaqt.me.git
   cd vaqt.me
   ```

2. **نصب وابستگی‌ها:**

   ```bash
   pnpm install
   ```

3. **راه‌اندازی زیرساخت (PostgreSQL + Redis):**

   ```bash
   docker compose up -d
   ```

4. **تنظیم متغیرهای محیطی:**
   - فایل‌های `.env.example` را در `apps/web` و `apps/api` مشاهده کنید
   - برای محیط لوکال، پیش‌فرض‌ها کافی است (همه provider ها روی mock)

5. **اجرای migration و seed:**

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

6. **اجرای برنامه در حالت development:**
   ```bash
   pnpm dev
   ```
   - وب: http://localhost:3000
   - API: http://localhost:3001
   - API Docs (Swagger): http://localhost:3001/docs
   - Adminer (مدیریت DB): http://localhost:8080

---

## اسکریپت‌های موجود

| اسکریپت             | توضیحات                               |
| ------------------- | ------------------------------------- |
| `pnpm dev`          | اجرای همه‌ی اپ‌ها در حالت development |
| `pnpm build`        | ساخت همه‌ی اپ‌ها برای production      |
| `pnpm lint`         | بررسی کیفیت کد با ESLint              |
| `pnpm lint:fix`     | اصلاح خودکار مشکلات lint              |
| `pnpm typecheck`    | بررسی تایپ‌ها با TypeScript           |
| `pnpm test`         | اجرای تست‌ها                          |
| `pnpm test:watch`   | اجرای تست‌ها در حالت watch            |
| `pnpm test:e2e`     | اجرای تست‌های end-to-end              |
| `pnpm format`       | فرمت کردن کد با Prettier              |
| `pnpm format:check` | بررسی فرمت کد                         |
| `pnpm db:migrate`   | اجرای migration های دیتابیس           |
| `pnpm db:seed`      | Seed کردن دیتابیس                     |
| `pnpm db:studio`    | باز کردن Prisma Studio                |
| `pnpm db:generate`  | تولید Prisma Client                   |

---

## ساختار پروژه

```
vaqt/
├─ apps/
│  ├─ api/          # NestJS API
│  └─ web/          # Next.js Web App
├─ packages/
│  ├─ db/           # Prisma schema & client
│  ├─ shared/       # Types, schemas, utils مشترک
│  └─ ui/           # Design system components
├─ docker-compose.yml
├─ turbo.json
├─ pnpm-workspace.yaml
├─ CLAUDE.md        # تصمیمات معماری
└─ PROJECT_SPEC.md  # مشخصات کامل پروژه
```

---

## متغیرهای محیطی

### Web (apps/web/.env)

```bash
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### API (apps/api/.env)

```bash
NODE_ENV=development
PORT=3001
WEB_ORIGIN=http://localhost:3000

# دیتابیس
DATABASE_URL=postgresql://vaqt:vaqt@localhost:5432/vaqt

# Redis
REDIS_URL=redis://localhost:6379

# JWT (در production حتماً تغییر دهید)
JWT_ACCESS_SECRET=your-access-secret-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production

# سرویس‌های خارجی (mock | production)
SMS_PROVIDER=mock
PAYMENT_PROVIDER=mock
AI_PROVIDER=mock
```

برای جزئیات بیشتر، فایل‌های `.env.example` را مشاهده کنید.

---

## قواعد توسعه

### Conventional Commits

همه‌ی کامیت‌ها باید از فرمت Conventional Commits پیروی کنند:

```
type(scope): subject

مثال:
feat(api): add OTP authentication
fix(web): resolve RTL layout issues
docs(readme): update installation steps
```

**Scopes مجاز:** `api`, `web`, `ui`, `shared`, `db`, `infra`, `ci`, `docs`

### قواعد RTL

**الزامی:** استفاده از یوتیلیتی‌های منطقی Tailwind:

✅ استفاده کنید:

```tsx
<div className="ps-4 pe-2 ms-auto text-start border-s">
```

❌ استفاده نکنید:

```tsx
<div className="pl-4 pr-2 ml-auto text-left border-left">
```

### کیفیت کد

- TypeScript strict mode در همه‌جا
- هیچ `any` استفاده نشود
- همه سرویس‌های backend باید تست داشته باشند
- کد بدون تست تحویل داده نمی‌شود

---

## فازهای پروژه

| فاز             | وضعیت        | توضیحات                          |
| --------------- | ------------ | -------------------------------- |
| ۰ — پایه        | ✅ تکمیل شده | Monorepo bootstrap               |
| ۱ — دیتابیس     | ⏳ در انتظار | Prisma schema + migration + seed |
| ۲ — احراز هویت  | ⏳ در انتظار | OTP + JWT + rate limit           |
| ۳ — سیستم طراحی | ⏳ در انتظار | Tailwind + Vazirmatn + shadcn/ui |
| ۴ — درخواست‌ها  | ⏳ در انتظار | CRUD + masking + pagination      |
| ۵ — AI          | ⏳ در انتظار | AI wizard + live preview         |
| ۶ — پیشنهادها   | ⏳ در انتظار | Offers + selection flow          |
| ۷ — چت          | ⏳ در انتظار | Socket.IO + conversations        |
| ۸ — پرداخت      | ⏳ در انتظار | Zarinpal + entitlements          |
| ۹ — تکمیل       | ⏳ در انتظار | Reviews + PWA + SEO              |
| ۱۰ — تحویل      | ⏳ در انتظار | E2E tests + security + docker    |

برای جزئیات هر فاز، به `PROJECT_SPEC.md` مراجعه کنید.

---

## مستندات

- **مشخصات کامل:** [PROJECT_SPEC.md](./PROJECT_SPEC.md)
- **تصمیمات معماری:** [CLAUDE.md](./CLAUDE.md)
- **API Documentation:** http://localhost:3001/docs (Swagger)
- **Database Schema:** [packages/db/prisma/schema.prisma](./packages/db/prisma/schema.prisma)

---

## لایسنس

این پروژه تحت لایسنس MIT منتشر شده است.
