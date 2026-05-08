-- Trainer mileage + expense helpers (Client Management tax prep).

CREATE TABLE "trainer_business_mileage_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "miles" REAL NOT NULL,
    "note" TEXT,
    "bookedTrainingSessionId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    CONSTRAINT "trainer_business_mileage_entries_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trainer_business_mileage_entries_bookedTrainingSessionId_fkey" FOREIGN KEY ("bookedTrainingSessionId") REFERENCES "booked_training_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "trainer_business_mileage_entries_trainerId_occurredAt_idx" ON "trainer_business_mileage_entries"("trainerId", "occurredAt");

CREATE TABLE "trainer_business_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "spentAt" DATETIME NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "likelyTaxDeductible" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "trainer_business_expenses_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "trainer_business_expenses_trainerId_spentAt_idx" ON "trainer_business_expenses"("trainerId", "spentAt");
