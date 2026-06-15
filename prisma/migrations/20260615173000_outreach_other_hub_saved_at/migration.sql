-- AlterTable
ALTER TABLE "outreach_other_leads" ADD COLUMN IF NOT EXISTS "savedToHubAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "outreach_other_leads_deletedAt_savedToHubAt_idx"
  ON "outreach_other_leads"("deletedAt", "savedToHubAt");
