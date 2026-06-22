-- Client freemium/VIP plan fields
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "clientPlanTier" TEXT NOT NULL DEFAULT 'FREEMIUM';
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "vipSubscriptionId" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "vipSubscriptionActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "freemiumSwipeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "freemiumSwipeWindowStartAt" TIMESTAMP(3);

-- Trainer deferred registration fee fields
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "accountDeactivatedAt" TIMESTAMP(3);
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "registrationFeeDeferred" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "registrationFeeDeferredBalanceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "registrationFeeDeferredStartAt" TIMESTAMP(3);
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "registrationFeeDeferredDeadlineAt" TIMESTAMP(3);
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "registrationFeeGraceDeadlineAt" TIMESTAMP(3);
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "registrationFeeWithholdPct" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "registrationFeeDeferredBannedAt" TIMESTAMP(3);
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "registrationFeeDeferredBanSsnHash" TEXT;
