-- NOTE: Prisma's diff proposed DROP INDEX "requests_searchText_trgm_idx" (raw-SQL GIN index it can't model); deliberately omitted, see CLAUDE.md.

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "reminder1SentAt" TIMESTAMP(3),
ADD COLUMN     "reminder24SentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "messenger_bindings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messenger_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "messenger_bindings_userId_platform_key" ON "messenger_bindings"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "messenger_bindings_platform_chatId_key" ON "messenger_bindings"("platform", "chatId");

-- AddForeignKey
ALTER TABLE "messenger_bindings" ADD CONSTRAINT "messenger_bindings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

