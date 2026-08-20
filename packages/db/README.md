# @vaqt/db

Prisma schema, migrations, and seed data for Vaqt.me. This is the **only**
workspace allowed to import `@prisma/client` — everything else (including
`apps/web`, which must never talk to the database at all) imports from
`@vaqt/db` instead, which re-exports the generated client and every model
type. This boundary is enforced by the root ESLint config's
`no-restricted-imports` rule (see `eslint.config.mjs` and
`apps/web/.eslintrc.json`).

## Scripts

| Script           | Does what                                                              |
| ---------------- | ---------------------------------------------------------------------- |
| `generate`       | Runs `prisma generate`. The real task — everything else depends on it. |
| `build`          | No-op placeholder (`@vaqt/db` has no compiled output of its own).      |
| `migrate`        | `prisma migrate dev` — creates/applies a migration locally.            |
| `migrate:deploy` | `prisma migrate deploy` — applies pending migrations, no prompts.      |
| `seed`           | Runs `src/seed.ts` — idempotent, safe to run repeatedly.               |
| `studio`         | Opens Prisma Studio.                                                   |

`generate` also runs automatically on `pnpm install` via `postinstall`, and
via `turbo`'s task graph before this package's own `build`/`lint`/
`typecheck`/`test` and before any dependent workspace's `build`/`typecheck`
(see the `@vaqt/db#*` overrides and the `^generate` dependency in the root
`turbo.json`).

## Schema

18 models total — the 17 named in `PROJECT_SPEC.md` section 3, plus one
join table (`RequestSkill`) added in Phase 1 so that `Request` ↔ `Skill`
is a proper many-to-many relation instead of a `String[]` column. See the
note in `PROJECT_SPEC.md` section 3 for the full rationale.

Enum values are defined once in `packages/shared/src/constants/enums.ts`
and mirrored here; `src/__tests__/enums.test.ts` asserts the two never
drift apart.

## Seed data

`pnpm db:seed` (from the repo root) or `pnpm seed` (from this package) is
**idempotent** — every row has a fixed id and is written via `upsert`, so
running it any number of times converges on the same row counts instead of
duplicating data. Verified by running it twice against a real Postgres
instance during Phase 1.

| Model          | Row count | Notes                                                                                                                       |
| -------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `User`         | 8         | 4 seekers (`usr-seeker-1..4`) + 4 providers with bios (`usr-provider-1..4`)                                                 |
| `Category`     | 12        | 7 top-level + 5 children (two-level tree)                                                                                   |
| `Skill`        | 12        | Spread across categories                                                                                                    |
| `Request`      | 15        | 2 `DRAFT`, 7 `PUBLISHED` (incl. one `isUrgent`, one `isFeatured`), 2 `OFFER_SELECTED`, 1 `CLOSED`, 2 `EXPIRED`, 1 `REMOVED` |
| `RequestSkill` | 11        | Join rows for the requests that declare `skillIds`                                                                          |
| `Offer`        | 20        | Spread across non-`DRAFT`, non-`REMOVED` requests                                                                           |
| `Conversation` | 2         | One per `OFFER_SELECTED` request, tied to its `SELECTED` offer                                                              |
| `Message`      | 6         | 3 per conversation: 1 `SYSTEM` (the selection notice) + 2 `TEXT`                                                            |
| `Review`       | 2         | One per conversation, seeker → provider                                                                                     |
| `Product`      | 5         | The full upgrade catalog: one row per `ProductCode` value                                                                   |

`req-thesis-literature` deliberately spells one word with Arabic Yeh (`ي`,
U+064A) instead of Persian Yeh (`ی`, U+06CC) in its description, so
`normalizeFa()` and the `pg_trgm` search index have a real case to prove
they work — confirmed by an end-to-end query during Phase 1 (see the
Phase 1 notes in `CLAUDE.md`).
