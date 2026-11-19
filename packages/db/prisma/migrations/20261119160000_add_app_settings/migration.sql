-- NOTE: Prisma's diff proposed DROP INDEX "requests_searchText_trgm_idx" (raw-SQL GIN index it can't model); deliberately omitted, see CLAUDE.md.

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

