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
    "twoFactorLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "stayLoggedIn" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangeNonce" TEXT,
    "passwordChangeExpires" DATETIME,
    "passwordChangeOtpHash" TEXT,
    "passwordChangeOtpExpires" DATETIME,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT
);
INSERT INTO "new_clients" ("createdAt", "dateOfBirth", "email", "firstName", "id", "lastName", "passwordChangeExpires", "passwordChangeNonce", "passwordChangeOtpExpires", "passwordChangeOtpHash", "passwordHash", "phone", "preferredName", "stayLoggedIn", "stripeCustomerId", "stripeSubscriptionId", "termsAcceptedAt", "twoFactorEnabled", "twoFactorMethod", "twoFactorOtpExpires", "twoFactorOtpHash", "updatedAt", "username", "zipCode") SELECT "createdAt", "dateOfBirth", "email", "firstName", "id", "lastName", "passwordChangeExpires", "passwordChangeNonce", "passwordChangeOtpExpires", "passwordChangeOtpHash", "passwordHash", "phone", "preferredName", "stayLoggedIn", "stripeCustomerId", "stripeSubscriptionId", "termsAcceptedAt", "twoFactorEnabled", "twoFactorMethod", "twoFactorOtpExpires", "twoFactorOtpHash", "updatedAt", "username", "zipCode" FROM "clients";
DROP TABLE "clients";
ALTER TABLE "new_clients" RENAME TO "clients";
CREATE UNIQUE INDEX "clients_username_key" ON "clients"("username");
CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
