-- Client sign-up platform trial + payment grace lifecycle
ALTER TABLE "public"."Client"
ADD COLUMN IF NOT EXISTS "platformTrialEndsAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paymentGraceUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "accountDeactivatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "platformTrialConsumed" BOOLEAN NOT NULL DEFAULT false;
