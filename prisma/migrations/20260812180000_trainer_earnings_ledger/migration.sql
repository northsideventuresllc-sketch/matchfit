-- Trainer cash-earnings ledger (Phase 2 prerequisite) + cashout OTP columns.

ALTER TABLE "trainers" ADD COLUMN "cashoutOtpHash" TEXT;
ALTER TABLE "trainers" ADD COLUMN "cashoutOtpExpires" TIMESTAMP(3);

CREATE TABLE "trainer_earnings_balances" (
    "trainerId" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_earnings_balances_pkey" PRIMARY KEY ("trainerId")
);

CREATE TABLE "trainer_earnings_ledger_entries" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "deltaCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceKey" TEXT,
    "metaJson" TEXT,

    CONSTRAINT "trainer_earnings_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trainer_earnings_ledger_entries_trainerId_reason_referenceKey_key" ON "trainer_earnings_ledger_entries"("trainerId", "reason", "referenceKey");

CREATE INDEX "trainer_earnings_ledger_entries_trainerId_createdAt_idx" ON "trainer_earnings_ledger_entries"("trainerId", "createdAt");

ALTER TABLE "trainer_earnings_balances" ADD CONSTRAINT "trainer_earnings_balances_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trainer_earnings_ledger_entries" ADD CONSTRAINT "trainer_earnings_ledger_entries_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
