-- SIGNUP FORM PROGRESS FOLLOW-UP TRACKING — ADDITIVE ONLY.
-- NOT APPLIED TO ANY LIVE DATABASE. Migration file only — flagged for JB review before
-- running `npm run db:migrate` against production. Nothing dropped, nothing renamed.
--
-- Adds dedupe/state columns for the 3-email abandoned-signup follow-up sequence
-- (src/lib/signup-abandonment-followup-cron.ts): how many of the 3 follow-ups a given
-- signup_form_progress row has received, and when the last one went out.

ALTER TABLE "signup_form_progress"
  ADD COLUMN IF NOT EXISTS "followupEmailsSent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastFollowupSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "signup_form_progress_stage_followupEmailsSent_updatedAt_idx"
  ON "signup_form_progress" ("stage", "followupEmailsSent", "updatedAt");
