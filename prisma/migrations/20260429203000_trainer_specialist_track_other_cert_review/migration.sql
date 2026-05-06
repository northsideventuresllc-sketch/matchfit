-- Specialist training path (CSCS / CES / group fitness) + optional "other" cert review badge.
ALTER TABLE "trainer_profiles" ADD COLUMN "onboardingTrackSpecialist" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainer_profiles" ADD COLUMN "specialistProfessionalRole" TEXT;
ALTER TABLE "trainer_profiles" ADD COLUMN "specialistCertificationUrl" TEXT;
ALTER TABLE "trainer_profiles" ADD COLUMN "specialistCertificationReviewStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "trainer_profiles" ADD COLUMN "otherCertificationReviewStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED';
