-- Session start punch-ins (geolocation snapshot), DIY wall-clock + extension workflow, punch miss bookkeeping.

CREATE TABLE "session_trainer_punch_ins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookedTrainingSessionId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "accuracyMeters" REAL,
    "source" TEXT NOT NULL DEFAULT 'WEB_GEOLOCATION',
    CONSTRAINT "session_trainer_punch_ins_bookedTrainingSessionId_fkey" FOREIGN KEY ("bookedTrainingSessionId") REFERENCES "booked_training_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_trainer_punch_ins_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "session_trainer_punch_ins_bookedTrainingSessionId_key" ON "session_trainer_punch_ins"("bookedTrainingSessionId");
CREATE INDEX "session_trainer_punch_ins_trainerId_createdAt_idx" ON "session_trainer_punch_ins"("trainerId", "createdAt");

ALTER TABLE "trainer_profiles" ADD COLUMN "consecutiveMissedSessionPunches" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "booked_training_sessions" ADD COLUMN "punchMissEvaluatedAt" DATETIME;

ALTER TABLE "diy_plan_engagements" ADD COLUMN "wallClockDeliverableDueAt" DATETIME;
ALTER TABLE "diy_plan_engagements" ADD COLUMN "clientPostDueAttestation" TEXT;
ALTER TABLE "diy_plan_engagements" ADD COLUMN "clientPostDueAttestedAt" DATETIME;
ALTER TABLE "diy_plan_engagements" ADD COLUMN "trainerUrgentUploadDeadlineAt" DATETIME;
ALTER TABLE "diy_plan_engagements" ADD COLUMN "extensionHoursRequested" REAL;
ALTER TABLE "diy_plan_engagements" ADD COLUMN "extensionRequestedAt" DATETIME;
ALTER TABLE "diy_plan_engagements" ADD COLUMN "extensionClientDecisionByAt" DATETIME;
ALTER TABLE "diy_plan_engagements" ADD COLUMN "extensionStatus" TEXT;
ALTER TABLE "diy_plan_engagements" ADD COLUMN "extendedDeliverableDueAt" DATETIME;
