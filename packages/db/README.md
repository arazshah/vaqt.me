# @vaqt/db

Prisma schema + client for Postgres. 14 tables (users/sessions/OTP, card, booking,
notifications, settings). Enums mirror `@vaqt/shared` (parity test in `src/__tests__`).

- `pnpm --filter @vaqt/db migrate` — create a migration (always additive; never edit old ones)
- `pnpm --filter @vaqt/db migrate:deploy` — apply
- `pnpm db:seed` — dev-only demo card (`vaqt.me/demo`)
