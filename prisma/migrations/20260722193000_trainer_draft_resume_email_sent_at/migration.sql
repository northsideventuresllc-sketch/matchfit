-- Zero-Sales Signup Engine (G3 drop-off resume): track whether the resume-signup
-- nudge email has already been sent for a given trainer draft, so the cron sends
-- it at most once per draft.
ALTER TABLE "trainer_drafts"
  ADD COLUMN IF NOT EXISTS "resumeEmailSentAt" TIMESTAMP(3);
