-- Archived / unmatched conversations (90-day retention + browse cooldown symmetry)
ALTER TABLE "trainer_client_conversations" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "trainer_client_conversations" ADD COLUMN "archiveExpiresAt" DATETIME;
ALTER TABLE "trainer_client_conversations" ADD COLUMN "unmatchInitiatedBy" TEXT;

CREATE INDEX "trainer_client_conversations_archiveExpiresAt_idx" ON "trainer_client_conversations"("archiveExpiresAt");

CREATE TABLE "trainer_client_browse_passes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "lastPassedAt" DATETIME,
    CONSTRAINT "trainer_client_browse_passes_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trainer_client_browse_passes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "trainer_client_browse_passes_trainerId_clientId_key" ON "trainer_client_browse_passes"("trainerId", "clientId");
CREATE INDEX "trainer_client_browse_passes_trainerId_idx" ON "trainer_client_browse_passes"("trainerId");
CREATE INDEX "trainer_client_browse_passes_clientId_idx" ON "trainer_client_browse_passes"("clientId");
