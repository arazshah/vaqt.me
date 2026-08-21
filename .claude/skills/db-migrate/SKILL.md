---
name: db-migrate
description: Create, review, apply, and verify a Prisma migration for @vaqt/db — specifically guards against Prisma's diff engine proposing to drop hand-written raw-SQL database objects (like the pg_trgm GIN index) that it can't represent natively and therefore misreads as drift. Use when the user asks to create, run, or apply a database migration, or after editing packages/db/prisma/schema.prisma.
disable-model-invocation: true
---

# db-migrate

Wraps the full `packages/db` migration workflow this project has hit real trouble with twice already (Phase 1 and Phase 3): Prisma's `migrate dev` diff engine doesn't know about database objects created via raw SQL in a migration file, because they have no equivalent `schema.prisma` attribute. It reads their mere existence as drift and proposes a `DROP` for them. If that proposal is ever applied blindly, a real, load-bearing index silently disappears.

This skill never edits `schema.prisma` itself — do that first (the model/field changes the user wants), then invoke this skill to turn it into a safe, applied migration.

## Known raw-SQL objects to protect

Keep this list current — whenever a future migration adds another database object that has no `schema.prisma` equivalent (another operator-class index, a trigger, a raw `CREATE EXTENSION`, etc.), add it here in the same PR that creates it.

| Object                         | Table      | Why it's invisible to Prisma                                                                    | Added in              |
| ------------------------------ | ---------- | ----------------------------------------------------------------------------------------------- | --------------------- |
| `requests_searchText_trgm_idx` | `requests` | GIN index with `gin_trgm_ops` operator class — Prisma has no schema syntax for operator classes | `20260820124448_init` |

The `pg_trgm` extension itself (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`, also in `20260820124448_init`) is a one-time bootstrap statement, not a per-migration diff target, so it doesn't need this same guard — Prisma never proposes to drop an extension it didn't create.

## Steps

1. **Get the migration name.** If the user's invocation didn't include one (e.g. `/db-migrate add_reviews_table`), ask for a short, descriptive, `snake_case` name before doing anything else.

2. **Confirm there's an actual schema change to migrate.** Run `git diff packages/db/prisma/schema.prisma`. If it's empty, stop and tell the user there's nothing to migrate — this skill turns an already-edited schema into a migration, it doesn't design the schema change itself.

3. **Confirm Postgres is reachable.** `docker ps --filter name=vaqt-postgres` should show a healthy container. If not, tell the user to start it (`docker-compose up -d`) rather than guessing.

4. **Create the migration without applying it yet**, from `packages/db`, with `DATABASE_URL` exported inline (this project never has a committed `.env`):

   ```
   cd packages/db
   DATABASE_URL="postgresql://vaqt:vaqt@localhost:5432/vaqt" pnpm exec prisma migrate dev --create-only --name <name>
   ```

   If a prior run already left an unapplied `--create-only` migration sitting in `prisma/migrations/`, don't create a duplicate — reuse it (open it and skip to step 5).

5. **Read the generated `migration.sql`** in full. For every object in the "Known raw-SQL objects to protect" table above, check whether this migration contains a `DROP INDEX`, `DROP TRIGGER`, or similar statement targeting it.
   - If found: remove that statement, and replace it with a short comment explaining why, matching the existing convention in this repo (see `packages/db/prisma/migrations/20260820154005_user_profile_fields_and_skills/migration.sql` for the exact tone/wording already used for this precise index). Tell the user plainly what you removed and why — don't silently edit a migration file without saying so.
   - If the diff _legitimately_ needs to touch a table that one of these objects lives on (e.g. adding another column to `requests`), that's fine — only the specific `DROP` of the protected object is the problem, not other statements in the same file.
   - If you find a `DROP`/structural change targeting some _other_ raw-SQL object not yet in the table above, stop and ask the user to confirm it's safe before proceeding — don't guess, and don't silently add it to the table without confirmation either.

6. **Show the final `migration.sql`** to the user before applying it (the whole file, not a summary) so they can see exactly what will run against the real database.

7. **Apply it.** Running the plain command again picks up and applies the pending `--create-only` migration:

   ```
   DATABASE_URL="postgresql://vaqt:vaqt@localhost:5432/vaqt" pnpm exec prisma migrate dev
   ```

8. **Regenerate the Prisma client explicitly** (belt-and-suspenders — `migrate dev` usually does this itself, but confirm rather than assume):

   ```
   DATABASE_URL="postgresql://vaqt:vaqt@localhost:5432/vaqt" pnpm exec prisma generate
   ```

9. **Verify.**
   - `DATABASE_URL="postgresql://vaqt:vaqt@localhost:5432/vaqt" pnpm exec prisma migrate status` must say "Database schema is up to date!".
   - For every protected object touched by this migration (i.e. any object whose table this migration modified), confirm it still exists on the real database — e.g. `docker exec vaqt-postgres psql -U vaqt -d vaqt -c '\d requests'` and check the index is listed. Don't just trust that your edit in step 5 was correct — look at the live database.

10. **Remind the user of anything this migration might require elsewhere**, if applicable — don't do these automatically, just flag them:
    - New or changed enum? `packages/shared/src/constants/enums.ts` is the source of truth and must be updated to match; `packages/db/src/__tests__/enums.test.ts` will fail otherwise.
    - New required fields with no default on a table the seed script touches? `packages/db/src/seed.ts` may need updating, and re-running `pnpm db:seed` twice is the way to confirm it's still idempotent.
    - Run `pnpm typecheck` at the repo root — the regenerated Prisma client's types ripple into every workspace that imports `@vaqt/db`.

11. **Do not commit.** Leave the migration files and any schema/seed follow-ups uncommitted unless the user explicitly asks for a commit — same rule as everywhere else in this project.
