-- Fitness Pro sign-up now goes straight to the agreement page and creates the account before
-- the email is confirmed (JB, 2026-08-04). Verification moved onto the dashboard, so the app
-- needs its own record of it instead of reading Supabase auth.users on every render.
ALTER TABLE "Trainer" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

-- Every Fitness Pro created under the old flow could not exist without a confirmed email —
-- the gate ran before the row was written. Backfill them as verified so the new dashboard
-- prompt does not appear for accounts that already proved their address.
UPDATE "Trainer" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
