-- Admin analytics dashboard: site traffic, preferences, goals, AI messages, live billing flags.

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "stripeBillingLiveMode" BOOLEAN;

ALTER TABLE "platform_revenue_events" ADD COLUMN IF NOT EXISTS "billingLiveMode" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "admin_dashboard_preferences" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "administratorId" TEXT NOT NULL,
    "widgetsJson" TEXT NOT NULL,
    CONSTRAINT "admin_dashboard_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_dashboard_preferences_administratorId_key"
  ON "admin_dashboard_preferences"("administratorId");

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

CREATE TABLE IF NOT EXISTS "site_analytics_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "targetPath" TEXT,
    "targetUrl" TEXT,
    "linkLabel" TEXT,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    CONSTRAINT "site_analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "site_analytics_events_createdAt_idx" ON "site_analytics_events"("createdAt");
CREATE INDEX IF NOT EXISTS "site_analytics_events_kind_createdAt_idx" ON "site_analytics_events"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "site_analytics_events_path_createdAt_idx" ON "site_analytics_events"("path", "createdAt");
CREATE INDEX IF NOT EXISTS "site_analytics_events_visitorId_createdAt_idx" ON "site_analytics_events"("visitorId", "createdAt");

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

UPDATE "platform_revenue_events" SET "billingLiveMode" = false WHERE "billingLiveMode" IS NULL;

DO $$ BEGIN
  ALTER TABLE "admin_dashboard_preferences"
    ADD CONSTRAINT "admin_dashboard_preferences_administratorId_fkey"
    FOREIGN KEY ("administratorId") REFERENCES "administrators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
