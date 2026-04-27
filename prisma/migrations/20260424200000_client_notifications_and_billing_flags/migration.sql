-- AlterTable
ALTER TABLE "clients" ADD COLUMN "notificationPrefsJson" TEXT;
ALTER TABLE "clients" ADD COLUMN "stripeSubscriptionActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN "subscriptionGraceUntil" DATETIME;

-- CreateTable
CREATE TABLE "client_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkHref" TEXT,
    "readAt" DATETIME,
    CONSTRAINT "client_notifications_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "client_notifications_clientId_createdAt_idx" ON "client_notifications"("clientId", "createdAt");
