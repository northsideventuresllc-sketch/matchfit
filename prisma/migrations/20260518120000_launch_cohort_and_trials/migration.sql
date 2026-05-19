-- Launch cohort, client subscription trials, trainer onboarding fee tracking
ALTER TABLE "clients" ADD COLUMN "launchCohortMember" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN "clientTrialPlan" TEXT;
ALTER TABLE "clients" ADD COLUMN "subscriptionTrialEndsAt" TIMESTAMP(3);
ALTER TABLE "clients" ADD COLUMN "trialEnding48hEmailSentAt" TIMESTAMP(3);
ALTER TABLE "clients" ADD COLUMN "trialEnding24hEmailSentAt" TIMESTAMP(3);

ALTER TABLE "pending_client_registrations" ADD COLUMN "clientTrialPlan" TEXT;
ALTER TABLE "pending_client_registrations" ADD COLUMN "launchCohortMember" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "trainers" ADD COLUMN "launchCohortMember" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "trainer_profiles" ADD COLUMN "launchPremiumEndsAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN "backgroundCheckPaidCents" INTEGER;
ALTER TABLE "trainer_profiles" ADD COLUMN "signupFeeBalancePaidAt" TIMESTAMP(3);
