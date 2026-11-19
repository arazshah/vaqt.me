-- NOTE: Prisma's diff proposed DROP INDEX "requests_searchText_trgm_idx" (raw-SQL GIN index it can't model); deliberately omitted, see CLAUDE.md.

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxDaysAhead" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "minNoticeHours" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "service_types" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_rules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_exceptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,

    CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "bookerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "bookerName" TEXT NOT NULL,
    "note" TEXT,
    "cancelToken" TEXT NOT NULL,
    "cancelledBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_types_userId_order_idx" ON "service_types"("userId", "order");

-- CreateIndex
CREATE INDEX "availability_rules_userId_weekday_idx" ON "availability_rules"("userId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "availability_exceptions_userId_date_key" ON "availability_exceptions"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_cancelToken_key" ON "bookings"("cancelToken");

-- CreateIndex
CREATE INDEX "bookings_providerId_startAt_idx" ON "bookings"("providerId", "startAt");

-- CreateIndex
CREATE INDEX "bookings_bookerId_startAt_idx" ON "bookings"("bookerId", "startAt");

-- AddForeignKey
ALTER TABLE "service_types" ADD CONSTRAINT "service_types_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bookerId_fkey" FOREIGN KEY ("bookerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

