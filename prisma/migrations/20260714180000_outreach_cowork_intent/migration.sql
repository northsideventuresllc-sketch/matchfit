-- Match Fit Outreach Cowork: intent field required before live send (MF-OUT-COWORK)
ALTER TABLE "outreach_instagram_leads"
  ADD COLUMN IF NOT EXISTS "outreachIntent" TEXT;
ALTER TABLE "outreach_facebook_leads"
  ADD COLUMN IF NOT EXISTS "outreachIntent" TEXT;
ALTER TABLE "outreach_email_leads"
  ADD COLUMN IF NOT EXISTS "outreachIntent" TEXT;
