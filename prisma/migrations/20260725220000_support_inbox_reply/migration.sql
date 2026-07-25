-- MF-SUPPORT-INBOX: reply-from-portal support.
-- Additive only; existing rows keep working with NULLs.
ALTER TABLE "public"."support_inbox_messages"
  ADD COLUMN IF NOT EXISTS "replyBody" TEXT,
  ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "replyEmailId" TEXT;
