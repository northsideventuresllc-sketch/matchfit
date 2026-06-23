-- Outreach Hub: track leads saved for follow-up export
ALTER TABLE "public"."outreach_instagram_leads" ADD COLUMN IF NOT EXISTS "savedToHubAt" TIMESTAMP(3);
ALTER TABLE "public"."outreach_facebook_leads" ADD COLUMN IF NOT EXISTS "savedToHubAt" TIMESTAMP(3);
ALTER TABLE "public"."outreach_email_leads" ADD COLUMN IF NOT EXISTS "savedToHubAt" TIMESTAMP(3);
ALTER TABLE "public"."outreach_other_leads" ADD COLUMN IF NOT EXISTS "savedToHubAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_deletedAt_savedToHubAt_idx" ON "public"."outreach_instagram_leads"("deletedAt", "savedToHubAt");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_deletedAt_savedToHubAt_idx" ON "public"."outreach_facebook_leads"("deletedAt", "savedToHubAt");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_deletedAt_savedToHubAt_idx" ON "public"."outreach_email_leads"("deletedAt", "savedToHubAt");
CREATE INDEX IF NOT EXISTS "outreach_other_leads_deletedAt_savedToHubAt_idx" ON "public"."outreach_other_leads"("deletedAt", "savedToHubAt");
