-- CreateTable
CREATE TABLE "client_trainer_browse_passes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    CONSTRAINT "client_trainer_browse_passes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "client_trainer_browse_passes_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "client_trainer_browse_passes_clientId_idx" ON "client_trainer_browse_passes"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_trainer_browse_passes_clientId_trainerId_key" ON "client_trainer_browse_passes"("clientId", "trainerId");
