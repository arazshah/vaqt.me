-- NOTE: Prisma's diff proposed DROP INDEX "requests_searchText_trgm_idx" (raw-SQL GIN index it can't model); deliberately omitted, see CLAUDE.md.

-- CreateTable
CREATE TABLE "card_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT,
    "linkKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_cards" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "cardUserId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'saved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "card_events_userId_createdAt_idx" ON "card_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "saved_cards_ownerId_createdAt_idx" ON "saved_cards"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "saved_cards_ownerId_cardUserId_key" ON "saved_cards"("ownerId", "cardUserId");

-- AddForeignKey
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_cardUserId_fkey" FOREIGN KEY ("cardUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

