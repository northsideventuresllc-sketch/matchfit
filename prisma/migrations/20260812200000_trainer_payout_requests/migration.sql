-- Trainer payout requests + standing payout schedules.

CREATE TABLE "trainer_payout_schedules" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trainerId" TEXT NOT NULL,
    "amountCents" INTEGER,
    "method" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "trainer_payout_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trainer_payout_requests" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trainerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "netCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "stripeTransferId" TEXT,
    "stripePayoutId" TEXT,
    "failureReason" TEXT,
    "scheduleId" TEXT,

    CONSTRAINT "trainer_payout_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trainer_payout_schedules_active_nextRunAt_idx" ON "trainer_payout_schedules"("active", "nextRunAt");
CREATE INDEX "trainer_payout_schedules_trainerId_idx" ON "trainer_payout_schedules"("trainerId");
CREATE INDEX "trainer_payout_requests_trainerId_createdAt_idx" ON "trainer_payout_requests"("trainerId", "createdAt");

ALTER TABLE "trainer_payout_schedules" ADD CONSTRAINT "trainer_payout_schedules_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trainer_payout_requests" ADD CONSTRAINT "trainer_payout_requests_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trainer_payout_requests" ADD CONSTRAINT "trainer_payout_requests_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "trainer_payout_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
