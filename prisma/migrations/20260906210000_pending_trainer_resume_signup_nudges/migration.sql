-- Zero-Sales Signup Engine (G3) approval gate (JB Decision #1280 / Learning #7461):
-- resume-signup nudges must be queued for explicit admin approval, never auto-sent
-- direct from the cron.

CREATE TABLE "pending_trainer_resume_signup_nudges" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerDraftId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedByAdminId" TEXT,

    CONSTRAINT "pending_trainer_resume_signup_nudges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_trainer_resume_signup_nudges_trainerDraftId_key" ON "pending_trainer_resume_signup_nudges"("trainerDraftId");

CREATE INDEX "pending_trainer_resume_signup_nudges_status_idx" ON "pending_trainer_resume_signup_nudges"("status");
