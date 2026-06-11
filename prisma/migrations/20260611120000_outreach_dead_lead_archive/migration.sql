-- Dead lead archive + per-admin outreach learning

ALTER TABLE "outreach_instagram_leads"
  ADD COLUMN IF NOT EXISTS "deadLeadAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivePurgeAfterAt" TIMESTAMP(3);

ALTER TABLE "outreach_facebook_leads"
  ADD COLUMN IF NOT EXISTS "deadLeadAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivePurgeAfterAt" TIMESTAMP(3);

ALTER TABLE "outreach_email_leads"
  ADD COLUMN IF NOT EXISTS "deadLeadAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivePurgeAfterAt" TIMESTAMP(3);

ALTER TABLE "outreach_learning_signals"
  ADD COLUMN IF NOT EXISTS "adminId" TEXT;

CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_archivedAt_archivePurgeAfterAt_idx"
  ON "outreach_instagram_leads"("archivedAt", "archivePurgeAfterAt");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_archivedAt_archivePurgeAfterAt_idx"
  ON "outreach_facebook_leads"("archivedAt", "archivePurgeAfterAt");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_archivedAt_archivePurgeAfterAt_idx"
  ON "outreach_email_leads"("archivedAt", "archivePurgeAfterAt");
CREATE INDEX IF NOT EXISTS "outreach_learning_signals_adminId_signalType_createdAt_idx"
  ON "outreach_learning_signals"("adminId", "signalType", "createdAt");
