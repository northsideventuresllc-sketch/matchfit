-- Financial ledger splits, two-gate payout lifecycle, disputes, payout buffer, DIY receivables.

ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "ledgerGrossTotalCents" INTEGER;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "ledgerStripeFeeEstimateCents" INTEGER;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "ledgerNetAfterFeesCents" INTEGER;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "ledgerNetServicePoolCents" INTEGER;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "ledgerNetAddonPoolCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "ledgerTotalServiceUnits" INTEGER;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "ledgerTotalAddonUnits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "ledgerPerServiceUnitNetCents" INTEGER;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "ledgerPerAddonUnitNetCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "payoutModel" TEXT;

ALTER TABLE "booked_training_sessions" ADD COLUMN "gateASatisfiedAt" DATETIME;
ALTER TABLE "booked_training_sessions" ADD COLUMN "gateASource" TEXT;
ALTER TABLE "booked_training_sessions" ADD COLUMN "gateARevokedBeforeStartAt" DATETIME;
ALTER TABLE "booked_training_sessions" ADD COLUMN "trainerGateBCompletedAt" DATETIME;
ALTER TABLE "booked_training_sessions" ADD COLUMN "payoutBufferEndsAt" DATETIME;
ALTER TABLE "booked_training_sessions" ADD COLUMN "payoutFundsFrozen" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "booked_training_sessions" ADD COLUMN "sessionConsumedUnits" REAL NOT NULL DEFAULT 1;
ALTER TABLE "booked_training_sessions" ADD COLUMN "allocatedNetAddonCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "booked_training_sessions" ADD COLUMN "disputeOpenedAt" DATETIME;

ALTER TABLE "diy_plan_engagements" ADD COLUMN "trainerReceivableLoggedAt" DATETIME;
ALTER TABLE "diy_plan_engagements" ADD COLUMN "clientReceivableAcknowledgedAt" DATETIME;
ALTER TABLE "diy_plan_engagements" ADD COLUMN "cycleFundsReleaseNotBeforeAt" DATETIME;
ALTER TABLE "diy_plan_engagements" ADD COLUMN "sourceServiceTransactionId" TEXT;

CREATE UNIQUE INDEX "diy_plan_engagements_sourceServiceTransactionId_key" ON "diy_plan_engagements"("sourceServiceTransactionId") WHERE "sourceServiceTransactionId" IS NOT NULL;

CREATE TABLE "session_payout_disputes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "bookedTrainingSessionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "answeredWasRescheduled" BOOLEAN NOT NULL,
    "answeredWasCancelled" BOOLEAN NOT NULL,
    "answeredReasonDetail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_ADMIN',
    CONSTRAINT "session_payout_disputes_bookedTrainingSessionId_fkey" FOREIGN KEY ("bookedTrainingSessionId") REFERENCES "booked_training_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_payout_disputes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "session_payout_disputes_status_idx" ON "session_payout_disputes"("status");
CREATE INDEX "session_payout_disputes_bookedTrainingSessionId_idx" ON "session_payout_disputes"("bookedTrainingSessionId");
