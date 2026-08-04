-- Match Fit went worldwide 2026-07-31 (JB decision). Additive country field for signup —
-- optional, non-breaking, matches columns already applied directly to the live DB.
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "pending_client_registrations" ADD COLUMN IF NOT EXISTS "country" TEXT;
