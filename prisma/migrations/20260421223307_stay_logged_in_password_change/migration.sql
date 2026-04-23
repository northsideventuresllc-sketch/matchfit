-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
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
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorMethod" TEXT NOT NULL DEFAULT 'NONE',
    "twoFactorOtpHash" TEXT,
    "twoFactorOtpExpires" DATETIME,
    "stayLoggedIn" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangeNonce" TEXT,
    "passwordChangeExpires" DATETIME,
    "passwordChangeOtpHash" TEXT,
    "passwordChangeOtpExpires" DATETIME,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT
);
INSERT INTO "new_clients" ("createdAt", "dateOfBirth", "email", "firstName", "id", "lastName", "passwordHash", "phone", "preferredName", "stripeCustomerId", "stripeSubscriptionId", "termsAcceptedAt", "twoFactorEnabled", "twoFactorMethod", "twoFactorOtpExpires", "twoFactorOtpHash", "updatedAt", "username", "zipCode") SELECT "createdAt", "dateOfBirth", "email", "firstName", "id", "lastName", "passwordHash", "phone", "preferredName", "stripeCustomerId", "stripeSubscriptionId", "termsAcceptedAt", "twoFactorEnabled", "twoFactorMethod", "twoFactorOtpExpires", "twoFactorOtpHash", "updatedAt", "username", "zipCode" FROM "clients";
DROP TABLE "clients";
ALTER TABLE "new_clients" RENAME TO "clients";
CREATE UNIQUE INDEX "clients_username_key" ON "clients"("username");
CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");
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
    "stayLoggedIn" BOOLEAN NOT NULL DEFAULT true,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT
);
INSERT INTO "new_pending_client_registrations" ("createdAt", "dateOfBirth", "email", "expiresAt", "firstName", "id", "lastName", "otpExpiresAt", "otpHash", "passwordHash", "phone", "preferredName", "status", "stripeCustomerId", "stripeSubscriptionId", "termsAcceptedAt", "twoFactorEnabled", "twoFactorMethod", "username", "zipCode") SELECT "createdAt", "dateOfBirth", "email", "expiresAt", "firstName", "id", "lastName", "otpExpiresAt", "otpHash", "passwordHash", "phone", "preferredName", "status", "stripeCustomerId", "stripeSubscriptionId", "termsAcceptedAt", "twoFactorEnabled", "twoFactorMethod", "username", "zipCode" FROM "pending_client_registrations";
DROP TABLE "pending_client_registrations";
ALTER TABLE "new_pending_client_registrations" RENAME TO "pending_client_registrations";
CREATE INDEX "pending_client_registrations_email_idx" ON "pending_client_registrations"("email");
CREATE INDEX "pending_client_registrations_username_idx" ON "pending_client_registrations"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
