-- Trainer onboarding fee deadline (7 days after TOS / account creation)
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "onboardingFeePaymentDeadlineAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "onboardingFeePaymentExpiredAt" TIMESTAMP(3);
