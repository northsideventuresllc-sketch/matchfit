-- CreateTable
CREATE TABLE "client_saved_trainers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "trainerInquiryStatus" TEXT NOT NULL DEFAULT 'ACCEPTED',
    CONSTRAINT "client_saved_trainers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_saved_trainers_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "client_saved_trainers_clientId_idx" ON "client_saved_trainers"("clientId");

-- CreateIndex
CREATE INDEX "client_saved_trainers_trainerId_trainerInquiryStatus_idx" ON "client_saved_trainers"("trainerId", "trainerInquiryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "client_saved_trainers_clientId_trainerId_key" ON "client_saved_trainers"("clientId", "trainerId");
