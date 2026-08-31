-- Outreach HQ v2 Send Queue: manual vs. agent send tracking.
ALTER TABLE "outreach_instagram_leads"
  ADD COLUMN IF NOT EXISTS "sendMode" TEXT,
  ADD COLUMN IF NOT EXISTS "manualSentAt" TIMESTAMP(3);

ALTER TABLE "outreach_facebook_leads"
  ADD COLUMN IF NOT EXISTS "sendMode" TEXT,
  ADD COLUMN IF NOT EXISTS "manualSentAt" TIMESTAMP(3);

ALTER TABLE "outreach_email_leads"
  ADD COLUMN IF NOT EXISTS "sendMode" TEXT,
  ADD COLUMN IF NOT EXISTS "manualSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_lane_send_mode_idx"
  ON "outreach_instagram_leads"("outreachLane", "sendMode");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_lane_send_mode_idx"
  ON "outreach_facebook_leads"("outreachLane", "sendMode");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_lane_send_mode_idx"
  ON "outreach_email_leads"("outreachLane", "sendMode");
