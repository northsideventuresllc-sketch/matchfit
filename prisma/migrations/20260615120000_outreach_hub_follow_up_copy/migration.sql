-- AlterTable
ALTER TABLE "outreach_instagram_leads" ADD COLUMN IF NOT EXISTS "followUp1DmText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "outreach_instagram_leads" ADD COLUMN IF NOT EXISTS "followUp2DmText" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "outreach_email_leads" ADD COLUMN IF NOT EXISTS "followUp1EmailSubject" TEXT NOT NULL DEFAULT '';
ALTER TABLE "outreach_email_leads" ADD COLUMN IF NOT EXISTS "followUp1EmailBody" TEXT NOT NULL DEFAULT '';
ALTER TABLE "outreach_email_leads" ADD COLUMN IF NOT EXISTS "followUp2EmailSubject" TEXT NOT NULL DEFAULT '';
ALTER TABLE "outreach_email_leads" ADD COLUMN IF NOT EXISTS "followUp2EmailBody" TEXT NOT NULL DEFAULT '';
