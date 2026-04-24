-- Professional path + nutrition certification uploads
ALTER TABLE "trainer_profiles" ADD COLUMN "nutritionistCertificationUrl" TEXT;
ALTER TABLE "trainer_profiles" ADD COLUMN "nutritionistCertificationReviewStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "trainer_profiles" ADD COLUMN "onboardingTrackCpt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainer_profiles" ADD COLUMN "onboardingTrackNutrition" BOOLEAN NOT NULL DEFAULT false;
