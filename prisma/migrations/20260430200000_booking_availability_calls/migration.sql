-- Trainer availability + conversation booking credits + service tx meta + booked session extensions

ALTER TABLE "trainer_profiles" ADD COLUMN "bookingAvailabilityJson" TEXT;
ALTER TABLE "trainer_profiles" ADD COLUMN "bookingTimezone" TEXT NOT NULL DEFAULT 'America/New_York';

ALTER TABLE "trainer_client_conversations" ADD COLUMN "sessionCreditsPurchased" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "trainer_client_conversations" ADD COLUMN "sessionCreditsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "trainer_client_conversations" ADD COLUMN "bookingUnlimitedAfterPurchase" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "serviceId" TEXT;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "billingUnit" TEXT;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "sessionCreditsGranted" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "bookingUnlimitedPurchase" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "booked_training_sessions" ADD COLUMN "conversationId" TEXT;
ALTER TABLE "booked_training_sessions" ADD COLUMN "scheduledEndAt" DATETIME;
ALTER TABLE "booked_training_sessions" ADD COLUMN "inviteNote" TEXT;
ALTER TABLE "booked_training_sessions" ADD COLUMN "sourceServiceTransactionId" TEXT;

CREATE INDEX "booked_training_sessions_trainerId_scheduledStartAt_idx" ON "booked_training_sessions"("trainerId", "scheduledStartAt");
CREATE INDEX "booked_training_sessions_conversationId_idx" ON "booked_training_sessions"("conversationId");
