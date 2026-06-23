-- Split trainer beta caps into Atlanta in-person + nationwide virtual pools.
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "virtualOnlyBetaSlot" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."beta_trainer_waitlist_entries" ADD COLUMN IF NOT EXISTS "invitedBetaPool" TEXT;
