-- AlterTable
ALTER TABLE "trainer_profiles" ADD COLUMN "dashboardActivatedAt" DATETIME;
ALTER TABLE "trainer_profiles" ADD COLUMN "matchQuestionnaireStatus" TEXT NOT NULL DEFAULT 'not_started';
