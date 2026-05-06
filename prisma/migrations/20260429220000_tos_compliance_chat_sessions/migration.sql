-- AlterTable
ALTER TABLE "trainer_profiles" ADD COLUMN "backgroundCheckClearedAt" DATETIME;
ALTER TABLE "trainer_profiles" ADD COLUMN "backgroundCheckExpiryWarningSentAt" DATETIME;

-- CreateTable
CREATE TABLE "chat_admin_review_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "matchedSignalsJson" TEXT NOT NULL,
    "bodyExcerpt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "chat_admin_review_items_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "trainer_client_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "chat_admin_review_items_status_createdAt_idx" ON "chat_admin_review_items"("status", "createdAt");

-- CreateTable
CREATE TABLE "trainer_discover_match_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainerId" TEXT NOT NULL,
    "bucket" INTEGER NOT NULL,
    "clientIdsJson" TEXT NOT NULL,
    CONSTRAINT "trainer_discover_match_batches_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "trainer_discover_match_batches_trainerId_bucket_key" ON "trainer_discover_match_batches"("trainerId", "bucket");
CREATE INDEX "trainer_discover_match_batches_trainerId_idx" ON "trainer_discover_match_batches"("trainerId");

-- CreateTable
CREATE TABLE "booked_training_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scheduledStartAt" DATETIME NOT NULL,
    "confirmationDeadlineAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "trainerAmountCents" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "booked_training_sessions_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "booked_training_sessions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "booked_training_sessions_status_confirmationDeadlineAt_idx" ON "booked_training_sessions"("status", "confirmationDeadlineAt");
CREATE INDEX "booked_training_sessions_trainerId_clientId_idx" ON "booked_training_sessions"("trainerId", "clientId");

-- CreateTable
CREATE TABLE "diy_plan_engagements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "engagementStartedAt" DATETIME NOT NULL,
    "firstDeliverByAt" DATETIME NOT NULL,
    "firstDeliveredAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING_DELIVERY',
    CONSTRAINT "diy_plan_engagements_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "diy_plan_engagements_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "diy_plan_engagements_status_firstDeliverByAt_idx" ON "diy_plan_engagements"("status", "firstDeliverByAt");
CREATE INDEX "diy_plan_engagements_trainerId_clientId_idx" ON "diy_plan_engagements"("trainerId", "clientId");
