-- Admin AI assistant, live billing flags, and sandbox revenue exclusion.

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "stripeBillingLiveMode" BOOLEAN;

ALTER TABLE "platform_revenue_events" ADD COLUMN IF NOT EXISTS "billingLiveMode" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "admin_goals" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "administratorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetMetric" TEXT,
    "targetValue" INTEGER,
    "deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "admin_goals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_goals_administratorId_status_idx"
  ON "admin_goals"("administratorId", "status");

CREATE TABLE IF NOT EXISTS "admin_ai_messages" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "administratorId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "actionType" TEXT,
    CONSTRAINT "admin_ai_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_ai_messages_administratorId_createdAt_idx"
  ON "admin_ai_messages"("administratorId", "createdAt");

CREATE INDEX IF NOT EXISTS "platform_revenue_events_billingLiveMode_createdAt_idx"
  ON "platform_revenue_events"("billingLiveMode", "createdAt");

UPDATE "clients"
SET "stripeBillingLiveMode" = false
WHERE LOWER("username") = 'jbfitness6299'
   OR LOWER("email") = 'jonnybooth22@gmail.com';

UPDATE "clients"
SET "stripeBillingLiveMode" = true
WHERE "stripeSubscriptionActive" = true
  AND "stripeSubscriptionId" IS NOT NULL
  AND TRIM("stripeSubscriptionId") <> ''
  AND "stripeBillingLiveMode" IS NULL;

DO $$ BEGIN
  ALTER TABLE "admin_goals"
    ADD CONSTRAINT "admin_goals_administratorId_fkey"
    FOREIGN KEY ("administratorId") REFERENCES "administrators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "admin_ai_messages"
    ADD CONSTRAINT "admin_ai_messages_administratorId_fkey"
    FOREIGN KEY ("administratorId") REFERENCES "administrators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
