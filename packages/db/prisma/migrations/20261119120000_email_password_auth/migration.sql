-- Email + password accounts; phone becomes optional (SMS login stays available).
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "email" TEXT;
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT;
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
