-- Stripe Connect Express account fields for trainer payouts.

ALTER TABLE "trainers" ADD COLUMN "stripeConnectAccountId" TEXT;
ALTER TABLE "trainers" ADD COLUMN "stripeConnectPayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainers" ADD COLUMN "stripeConnectChargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainers" ADD COLUMN "stripeConnectOnboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "trainers" ADD COLUMN "stripeConnectRequirementsDueJson" TEXT;
ALTER TABLE "trainers" ADD COLUMN "stripeConnectDisabledReason" TEXT;

CREATE UNIQUE INDEX "trainers_stripeConnectAccountId_key" ON "trainers"("stripeConnectAccountId");
