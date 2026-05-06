-- Idempotent post-purchase receipts / in-app notifications (see `coach-service-purchase-side-effects.ts`).
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "purchaseSideEffectsAt" DATETIME;
ALTER TABLE "trainer_client_service_transactions" ADD COLUMN "purchaseLabelSnapshot" TEXT;
