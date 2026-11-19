-- AlterTable: public contact phone, street address and map pin on the card.
ALTER TABLE "cards" ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;
