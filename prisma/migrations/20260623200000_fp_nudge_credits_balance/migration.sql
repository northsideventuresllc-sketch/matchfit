-- Independent Fitness Pro purchased nudge pack credits

ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "nudgeCreditsBalance" INTEGER NOT NULL DEFAULT 0;
