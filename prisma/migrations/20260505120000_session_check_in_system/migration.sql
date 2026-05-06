-- Session check-in, reschedule workflow, Stripe refund linkage, package cancellation queue.

ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "stripePaymentIntentId" TEXT;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "totalChargedCents" INTEGER;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "adminFeeCents" INTEGER;

CREATE INDEX "trainer_client_service_transactions_stripePaymentIntentId_idx" ON "trainer_client_service_transactions"("stripePaymentIntentId");

ALTER TABLE "trainer_client_conversations" ADD COLUMN "blockFreeSessionBookingUntilRepurchase" BOOLEAN NOT NULL DEFAULT 0;

ALTER TABLE "booked_training_sessions" ADD COLUMN "fulfillmentStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "booked_training_sessions" ADD COLUMN "allocatedCoachServiceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "booked_training_sessions" ADD COLUMN "markedCompleteAt" DATETIME;
ALTER TABLE "booked_training_sessions" ADD COLUMN "markedNotCompleteAt" DATETIME;
ALTER TABLE "booked_training_sessions" ADD COLUMN "sessionClosedAt" DATETIME;
ALTER TABLE "booked_training_sessions" ADD COLUMN "lastStripeRefundId" TEXT;
ALTER TABLE "booked_training_sessions" ADD COLUMN "lastStripeRefundCents" INTEGER;
ALTER TABLE "booked_training_sessions" ADD COLUMN "attributionStripePaymentIntentId" TEXT;

UPDATE "booked_training_sessions" SET "fulfillmentStatus" = 'SCHEDULED' WHERE "status" = 'CLIENT_CONFIRMED' AND "fulfillmentStatus" = 'NONE';

CREATE TABLE "session_reschedule_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "bookedTrainingSessionId" TEXT NOT NULL,
    "requestedByTrainer" BOOLEAN NOT NULL,
    "proposedStartAt" DATETIME NOT NULL,
    "proposedEndAt" DATETIME NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "session_reschedule_requests_bookedTrainingSessionId_fkey" FOREIGN KEY ("bookedTrainingSessionId") REFERENCES "booked_training_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "session_reschedule_requests_bookedTrainingSessionId_idx" ON "session_reschedule_requests"("bookedTrainingSessionId");
CREATE INDEX "session_reschedule_requests_status_idx" ON "session_reschedule_requests"("status");

CREATE TABLE "trainer_package_cancellation_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "conversationId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "adminDecisionNotes" TEXT,
    CONSTRAINT "trainer_package_cancellation_requests_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "trainer_client_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trainer_package_cancellation_requests_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trainer_package_cancellation_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "trainer_package_cancellation_requests_status_idx" ON "trainer_package_cancellation_requests"("status");
CREATE INDEX "trainer_package_cancellation_requests_trainerId_idx" ON "trainer_package_cancellation_requests"("trainerId");
