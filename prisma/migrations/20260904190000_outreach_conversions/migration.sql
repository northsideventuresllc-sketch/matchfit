-- Outreach HQ v2 Successful Conversions: "Converted" lane + per-touch send history.
ALTER TABLE "outreach_instagram_leads"
  ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "convertedByAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "matchedAccountType" TEXT,
  ADD COLUMN IF NOT EXISTS "matchedAccountId" TEXT;

ALTER TABLE "outreach_facebook_leads"
  ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "convertedByAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "matchedAccountType" TEXT,
  ADD COLUMN IF NOT EXISTS "matchedAccountId" TEXT;

ALTER TABLE "outreach_email_leads"
  ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "convertedByAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "matchedAccountType" TEXT,
  ADD COLUMN IF NOT EXISTS "matchedAccountId" TEXT;

CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_converted_idx"
  ON "outreach_instagram_leads"("convertedAt");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_converted_idx"
  ON "outreach_facebook_leads"("convertedAt");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_converted_idx"
  ON "outreach_email_leads"("convertedAt");

CREATE TABLE IF NOT EXISTS "outreach_lead_touch_log" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "platform" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL,
  "sendMode" TEXT NOT NULL,
  "messageFields" JSONB NOT NULL,
  "dispatchBatchId" TEXT,
  "performedByAdminId" TEXT,
  "reconstructed" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "outreach_lead_touch_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "outreach_lead_touch_log_leadId_platform_sentAt_idx"
  ON "outreach_lead_touch_log"("leadId", "platform", "sentAt");
