-- Trainer private coaching notes, client-visible goals, session diary summaries.

CREATE TABLE "trainer_client_coaching_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "generalNotes" TEXT,
    "medicalInjuryNotes" TEXT,
    CONSTRAINT "trainer_client_coaching_profiles_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trainer_client_coaching_profiles_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "trainer_client_coaching_profiles_trainerId_clientId_key" ON "trainer_client_coaching_profiles"("trainerId", "clientId");
CREATE INDEX "trainer_client_coaching_profiles_clientId_idx" ON "trainer_client_coaching_profiles"("clientId");

CREATE TABLE "trainer_client_goals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "horizon" TEXT NOT NULL,
    "goalText" TEXT NOT NULL,
    "completionCriteria" TEXT NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "trainer_client_goals_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trainer_client_goals_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "trainer_client_goals_trainerId_clientId_idx" ON "trainer_client_goals"("trainerId", "clientId");
CREATE INDEX "trainer_client_goals_clientId_idx" ON "trainer_client_goals"("clientId");

CREATE TABLE "trainer_client_session_summaries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "body" TEXT NOT NULL,
    "emailedAt" DATETIME,
    CONSTRAINT "trainer_client_session_summaries_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trainer_client_session_summaries_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "trainer_client_session_summaries_trainerId_clientId_occurredAt_idx" ON "trainer_client_session_summaries"("trainerId", "clientId", "occurredAt");
CREATE INDEX "trainer_client_session_summaries_clientId_idx" ON "trainer_client_session_summaries"("clientId");
