-- Checkr background screening + human review tracking
ALTER TABLE "trainer_profiles" ADD COLUMN "checkrReportId" TEXT;
ALTER TABLE "trainer_profiles" ADD COLUMN "checkrInvitationId" TEXT;
ALTER TABLE "trainer_profiles" ADD COLUMN "backgroundCheckHumanReviewRequestedAt" TIMESTAMP(3);

CREATE TABLE "trainer_onboarding_denials" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "trainerId" TEXT,
    "reason" TEXT,

    CONSTRAINT "trainer_onboarding_denials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trainer_onboarding_denials_email_key" ON "trainer_onboarding_denials"("email");
CREATE UNIQUE INDEX "trainer_onboarding_denials_trainerId_key" ON "trainer_onboarding_denials"("trainerId");

ALTER TABLE "trainer_onboarding_denials" ADD CONSTRAINT "trainer_onboarding_denials_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
