-- AlterTable
ALTER TABLE "clients" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "clients" ADD COLUMN "stripeSubscriptionId" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pending_client_registrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "preferredName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "dateOfBirth" TEXT NOT NULL,
    "termsAcceptedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_2FA',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorMethod" TEXT NOT NULL,
    "otpHash" TEXT,
    "otpExpiresAt" DATETIME,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT
);
INSERT INTO "new_pending_client_registrations" ("createdAt", "dateOfBirth", "email", "expiresAt", "firstName", "id", "lastName", "otpExpiresAt", "otpHash", "passwordHash", "phone", "preferredName", "termsAcceptedAt", "twoFactorMethod", "username", "zipCode") SELECT "createdAt", "dateOfBirth", "email", "expiresAt", "firstName", "id", "lastName", "otpExpiresAt", "otpHash", "passwordHash", "phone", "preferredName", "termsAcceptedAt", "twoFactorMethod", "username", "zipCode" FROM "pending_client_registrations";
DROP TABLE "pending_client_registrations";
ALTER TABLE "new_pending_client_registrations" RENAME TO "pending_client_registrations";
CREATE INDEX "pending_client_registrations_email_idx" ON "pending_client_registrations"("email");
CREATE INDEX "pending_client_registrations_username_idx" ON "pending_client_registrations"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
