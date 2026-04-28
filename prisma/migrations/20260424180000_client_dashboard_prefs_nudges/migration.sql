-- AlterTable
ALTER TABLE "clients" ADD COLUMN "matchPreferencesJson" TEXT;
ALTER TABLE "clients" ADD COLUMN "matchPreferencesCompletedAt" DATETIME;
ALTER TABLE "clients" ADD COLUMN "allowTrainerDiscovery" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "trainer_client_nudges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "message" TEXT,
    "readAt" DATETIME,
    CONSTRAINT "trainer_client_nudges_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trainer_client_nudges_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "client_saved_trainers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    CONSTRAINT "client_saved_trainers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_saved_trainers_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "trainer_client_nudges_clientId_createdAt_idx" ON "trainer_client_nudges"("clientId", "createdAt");
CREATE INDEX "trainer_client_nudges_trainerId_idx" ON "trainer_client_nudges"("trainerId");
CREATE INDEX "client_saved_trainers_clientId_idx" ON "client_saved_trainers"("clientId");
CREATE UNIQUE INDEX "client_saved_trainers_clientId_trainerId_key" ON "client_saved_trainers"("clientId", "trainerId");
