ALTER TABLE "clients" ADD COLUMN "dailyAlgorithmContextJson" TEXT;

CREATE TABLE "client_daily_questionnaires" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "windowStartedAt" DATETIME NOT NULL,
    "questionsJson" TEXT NOT NULL,
    "answersJson" TEXT,
    "completedAt" DATETIME,
    CONSTRAINT "client_daily_questionnaires_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "client_daily_questionnaires_clientId_windowStartedAt_idx" ON "client_daily_questionnaires"("clientId", "windowStartedAt");
