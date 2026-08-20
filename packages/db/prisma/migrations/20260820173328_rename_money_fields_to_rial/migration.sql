-- Currency-unit reversal (see CLAUDE.md "مبالغ"): all stored money fields
-- now hold Rial instead of Toman. This migration only renames columns and
-- the enum label — the numeric values are NOT transformed here (they are
-- still Toman-scaled at this point). packages/db/src/seed.ts is updated
-- separately to author its literals in Rial (x10) and must be re-run for
-- the dev database to actually hold correct Rial numbers.

-- Hand-written (not prisma-diff-generated): a plain column/type rename
-- preserves existing row values exactly, whereas Prisma's default diff
-- engine would model this as DROP + ADD NOT NULL and refuse (or lose data)
-- since these columns are populated.

ALTER TABLE "requests" RENAME COLUMN "budgetMin" TO "budgetMinRial";
ALTER TABLE "requests" RENAME COLUMN "budgetMax" TO "budgetMaxRial";
ALTER TABLE "offers" RENAME COLUMN "price" TO "amountRial";
ALTER TABLE "products" RENAME COLUMN "priceIRT" TO "priceRial";
ALTER TABLE "orders" RENAME COLUMN "amountIRT" TO "amountRial";

-- Renaming an enum label preserves every existing row's value under the
-- new name (same underlying oid) — not a data rewrite.
ALTER TYPE "Currency" RENAME VALUE 'IRT' TO 'IRR';
