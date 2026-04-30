CREATE TABLE "client_bug_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "reporterName" TEXT,
    "reporterEmail" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "client_bug_reports_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "client_bug_reports_clientId_createdAt_idx" ON "client_bug_reports"("clientId", "createdAt");
