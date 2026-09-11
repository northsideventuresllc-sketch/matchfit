-- Independent Pro platform trial + Stripe subscription fields on trainers
ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "subscriptionGraceUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "platformTrialEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentGraceUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "platformTrialConsumed" BOOLEAN NOT NULL DEFAULT false;
