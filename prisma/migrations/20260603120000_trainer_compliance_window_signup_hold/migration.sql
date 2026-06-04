-- Trainer phased signup: limited dashboard after held registration payment; 7-day cert/BG window.

ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "limitedDashboardUnlockedAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "complianceWindowStartedAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "complianceWindowPausedAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "complianceCertReuploadDeadlineAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "complianceHumanReviewDeadlineAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "complianceCertFailedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "complianceWindowExpiredAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "registrationFeeHoldPaymentIntentId" TEXT;
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "registrationFeeHoldStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "fitHubPromoEndsAt" TIMESTAMP(3);

ALTER TABLE "trainers" ALTER COLUMN "termsAcceptedAt" DROP NOT NULL;

-- Existing coaches keep dashboard access without repeating signup payment.
UPDATE "trainer_profiles"
SET
  "limitedDashboardUnlockedAt" = COALESCE("dashboardActivatedAt", "createdAt"),
  "registrationFeeHoldStatus" = CASE
    WHEN "hasPaidRegistrationFee" = true THEN 'CAPTURED'
    WHEN "hasSignedTOS" = true THEN 'HELD'
    ELSE "registrationFeeHoldStatus"
  END
WHERE "limitedDashboardUnlockedAt" IS NULL
  AND ("dashboardActivatedAt" IS NOT NULL OR "hasPaidRegistrationFee" = true OR "hasSignedTOS" = true);
