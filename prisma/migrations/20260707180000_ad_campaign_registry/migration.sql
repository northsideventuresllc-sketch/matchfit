-- Manual ad campaign ID registry for /admin/ad-tracking (playbook step 9)

CREATE TABLE IF NOT EXISTS "ad_campaign_registry" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "campaignId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "venture" TEXT NOT NULL,
  "budgetCents" INTEGER,
  "weekOf" TEXT,
  "notes" TEXT,
  CONSTRAINT "ad_campaign_registry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ad_campaign_registry_platform_weekOf_idx"
  ON "ad_campaign_registry" ("platform", "weekOf");

CREATE INDEX IF NOT EXISTS "ad_campaign_registry_venture_weekOf_idx"
  ON "ad_campaign_registry" ("venture", "weekOf");

ALTER TABLE public.ad_campaign_registry ENABLE ROW LEVEL SECURITY;
