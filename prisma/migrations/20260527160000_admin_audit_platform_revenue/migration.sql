-- Administrator impersonation audit + platform revenue ledger (admin reporting).

CREATE TABLE "administrator_audit_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "administratorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetUsername" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "administrator_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_revenue_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "revenueCents" INTEGER NOT NULL,
    "grossProfitCents" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "clientId" TEXT,
    "trainerId" TEXT,
    "metaJson" TEXT,

    CONSTRAINT "platform_revenue_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_revenue_events_idempotencyKey_key" ON "platform_revenue_events"("idempotencyKey");

CREATE INDEX "administrator_audit_logs_administratorId_createdAt_idx" ON "administrator_audit_logs"("administratorId", "createdAt");

CREATE INDEX "administrator_audit_logs_targetRole_targetId_createdAt_idx" ON "administrator_audit_logs"("targetRole", "targetId", "createdAt");

CREATE INDEX "platform_revenue_events_category_createdAt_idx" ON "platform_revenue_events"("category", "createdAt");

ALTER TABLE "administrator_audit_logs" ADD CONSTRAINT "administrator_audit_logs_administratorId_fkey" FOREIGN KEY ("administratorId") REFERENCES "administrators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
