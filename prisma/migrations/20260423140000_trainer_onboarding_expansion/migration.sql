-- AlterTable trainers — onboarding profile fields
ALTER TABLE "trainers" ADD COLUMN "preferredName" TEXT;
ALTER TABLE "trainers" ADD COLUMN "pronouns" TEXT;
ALTER TABLE "trainers" ADD COLUMN "ethnicity" TEXT;
ALTER TABLE "trainers" ADD COLUMN "languagesSpoken" TEXT;
ALTER TABLE "trainers" ADD COLUMN "fitnessNiches" TEXT;
ALTER TABLE "trainers" ADD COLUMN "yearsCoaching" TEXT;
ALTER TABLE "trainers" ADD COLUMN "genderIdentity" TEXT;
ALTER TABLE "trainers" ADD COLUMN "profileImageUrl" TEXT;
ALTER TABLE "trainers" ADD COLUMN "socialInstagram" TEXT;
ALTER TABLE "trainers" ADD COLUMN "socialTiktok" TEXT;
ALTER TABLE "trainers" ADD COLUMN "socialFacebook" TEXT;
ALTER TABLE "trainers" ADD COLUMN "socialLinkedin" TEXT;
ALTER TABLE "trainers" ADD COLUMN "socialOtherUrl" TEXT;

-- AlterTable trainer_profiles
ALTER TABLE "trainer_profiles" ADD COLUMN "otherCertificationUrl" TEXT;
ALTER TABLE "trainer_profiles" ADD COLUMN "w9Json" TEXT;

-- Normalize legacy status strings to uppercase pipeline values
UPDATE "trainer_profiles" SET "backgroundCheckStatus" = 'NOT_STARTED' WHERE "backgroundCheckStatus" = 'pending';
UPDATE "trainer_profiles" SET "backgroundCheckStatus" = 'APPROVED' WHERE "backgroundCheckStatus" = 'approved';

UPDATE "trainer_profiles" SET "certificationReviewStatus" = 'NOT_STARTED' WHERE "certificationReviewStatus" = 'none';
UPDATE "trainer_profiles" SET "certificationReviewStatus" = 'PENDING' WHERE "certificationReviewStatus" = 'pending_human_review';
UPDATE "trainer_profiles" SET "certificationReviewStatus" = 'APPROVED' WHERE "certificationReviewStatus" = 'approved';

UPDATE "trainer_profiles" SET "backgroundCheckReviewStatus" = 'NOT_STARTED' WHERE "backgroundCheckReviewStatus" = 'none';
UPDATE "trainer_profiles" SET "backgroundCheckReviewStatus" = 'NEEDS_FURTHER_REVIEW' WHERE "backgroundCheckReviewStatus" = 'pending_human_review';
UPDATE "trainer_profiles" SET "backgroundCheckReviewStatus" = 'APPROVED' WHERE "backgroundCheckReviewStatus" = 'approved';
