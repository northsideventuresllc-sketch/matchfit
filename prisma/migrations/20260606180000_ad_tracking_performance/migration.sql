-- UTM attribution on site analytics + daily ad platform performance snapshots

ALTER TABLE "site_analytics_events"
  ADD COLUMN IF NOT EXISTS "utmSource" TEXT,
  ADD COLUMN IF NOT EXISTS "utmMedium" TEXT,
  ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT,
  ADD COLUMN IF NOT EXISTS "utmContent" TEXT,
  ADD COLUMN IF NOT EXISTS "utmTerm" TEXT;

CREATE INDEX IF NOT EXISTS "site_analytics_events_utmSource_utmCampaign_createdAt_idx"
  ON "site_analytics_events" ("utmSource", "utmCampaign", "createdAt");

CREATE TABLE IF NOT EXISTS "ad_platform_daily_snapshots" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "platform" TEXT NOT NULL,
  "dayKey" TEXT NOT NULL,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "spendCents" INTEGER NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "rawJson" TEXT,
  CONSTRAINT "ad_platform_daily_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ad_platform_daily_snapshots_platform_dayKey_key"
  ON "ad_platform_daily_snapshots" ("platform", "dayKey");

CREATE INDEX IF NOT EXISTS "ad_platform_daily_snapshots_dayKey_idx"
  ON "ad_platform_daily_snapshots" ("dayKey");
