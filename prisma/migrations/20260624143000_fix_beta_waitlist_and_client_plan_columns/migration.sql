-- Repair production columns missed when 20260611120000_beta_trainer_pools targeted the wrong
-- trainer profile table name ("TrainerProfile" vs "trainer_profiles"). Idempotent for re-runs.

ALTER TABLE "public"."trainer_profiles"
  ADD COLUMN IF NOT EXISTS "virtualOnlyBetaSlot" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."beta_trainer_waitlist_entries"
  ADD COLUMN IF NOT EXISTS "invitedBetaPool" TEXT;

-- Client Free/VIP plan columns (also in 20260619120000_client_freemium_vip_trainer_deferred_fee).
ALTER TABLE "public"."clients"
  ADD COLUMN IF NOT EXISTS "clientPlanTier" TEXT NOT NULL DEFAULT 'FREEMIUM';

ALTER TABLE "public"."clients"
  ADD COLUMN IF NOT EXISTS "vipSubscriptionId" TEXT;

ALTER TABLE "public"."clients"
  ADD COLUMN IF NOT EXISTS "vipSubscriptionActive" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."clients"
  ADD COLUMN IF NOT EXISTS "freemiumSwipeCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "public"."clients"
  ADD COLUMN IF NOT EXISTS "freemiumSwipeWindowStartAt" TIMESTAMP(3);
