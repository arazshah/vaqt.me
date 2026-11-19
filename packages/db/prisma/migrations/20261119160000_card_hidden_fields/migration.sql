-- AlterTable: which details the owner keeps OFF the printed business card.
ALTER TABLE "cards" ADD COLUMN "hiddenCardFields" TEXT[] DEFAULT ARRAY[]::TEXT[];
