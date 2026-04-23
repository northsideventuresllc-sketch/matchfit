-- CreateTable
CREATE TABLE "client_two_factor_channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientId" TEXT NOT NULL,
    "delivery" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifyOtpHash" TEXT,
    "verifyOtpExpires" DATETIME,
    "isDefaultLogin" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "client_two_factor_channels_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "client_two_factor_channels_clientId_idx" ON "client_two_factor_channels"("clientId");

-- Backfill: one channel per client that already had 2FA enabled (legacy single-method model).
INSERT INTO "client_two_factor_channels" ("id", "createdAt", "updatedAt", "clientId", "delivery", "email", "phone", "verified", "verifyOtpHash", "verifyOtpExpires", "isDefaultLogin")
SELECT
    lower(hex(randomblob(16))),
    datetime('now'),
    datetime('now'),
    "id",
    "twoFactorMethod",
    CASE WHEN "twoFactorMethod" = 'EMAIL' THEN "email" ELSE NULL END,
    CASE WHEN "twoFactorMethod" IN ('SMS', 'VOICE') THEN "phone" ELSE NULL END,
    1,
    NULL,
    NULL,
    1
FROM "clients"
WHERE "twoFactorEnabled" = 1
  AND "twoFactorMethod" IS NOT NULL
  AND "twoFactorMethod" != 'NONE';
