-- AlterTable
ALTER TABLE "clients" ADD COLUMN "addressCity" TEXT;
ALTER TABLE "clients" ADD COLUMN "addressCountry" TEXT;
ALTER TABLE "clients" ADD COLUMN "addressLine1" TEXT;
ALTER TABLE "clients" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "clients" ADD COLUMN "addressPostal" TEXT;
ALTER TABLE "clients" ADD COLUMN "addressState" TEXT;
ALTER TABLE "clients" ADD COLUMN "bio" TEXT;
ALTER TABLE "clients" ADD COLUMN "emailChangeExpires" DATETIME;
ALTER TABLE "clients" ADD COLUMN "emailChangeNonce" TEXT;
ALTER TABLE "clients" ADD COLUMN "lastEmailChangeRequest" DATETIME;
ALTER TABLE "clients" ADD COLUMN "lastPhoneChangeRequest" DATETIME;
ALTER TABLE "clients" ADD COLUMN "pendingEmail" TEXT;
ALTER TABLE "clients" ADD COLUMN "pendingPhone" TEXT;
ALTER TABLE "clients" ADD COLUMN "phoneChangeOtpExpires" DATETIME;
ALTER TABLE "clients" ADD COLUMN "phoneChangeOtpHash" TEXT;
ALTER TABLE "clients" ADD COLUMN "profileImageUrl" TEXT;
ALTER TABLE "clients" ADD COLUMN "usernameChangedAt" DATETIME;
