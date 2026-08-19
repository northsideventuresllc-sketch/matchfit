-- Per-campaign ad platform performance (level=campaign Insights sync) for the
-- Ad Tracking HQ per-campaign drilldown (MF-AD-TRACKING-UX). Keyed to
-- AdCampaignRegistry.campaignId, not on-site UTM strings, so it lines up with the
-- platform-native campaign ID operators already paste into the Campaign Registry.

CREATE TABLE IF NOT EXISTS "ad_campaign_daily_snapshots" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "campaignId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "dayKey" TEXT NOT NULL,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "spendCents" INTEGER NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "rawJson" TEXT,
  CONSTRAINT "ad_campaign_daily_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ad_campaign_daily_snapshots_platform_campaignId_dayKey_key"
  ON "ad_campaign_daily_snapshots" ("platform", "campaignId", "dayKey");

CREATE INDEX IF NOT EXISTS "ad_campaign_daily_snapshots_dayKey_idx"
  ON "ad_campaign_daily_snapshots" ("dayKey");

CREATE INDEX IF NOT EXISTS "ad_campaign_daily_snapshots_platform_campaignId_idx"
  ON "ad_campaign_daily_snapshots" ("platform", "campaignId");

ALTER TABLE public.ad_campaign_daily_snapshots ENABLE ROW LEVEL SECURITY;
