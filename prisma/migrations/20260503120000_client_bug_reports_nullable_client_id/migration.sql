-- Align `client_bug_reports.clientId` with Prisma: nullable for anonymous / unauthenticated reports.
PRAGMA foreign_keys=OFF;

CREATE TABLE "client_bug_reports_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "reporterName" TEXT,
    "reporterEmail" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "client_bug_reports_new_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "client_bug_reports_new" ("id", "createdAt", "clientId", "anonymous", "reporterName", "reporterEmail", "category", "description")
SELECT "id", "createdAt", "clientId", "anonymous", "reporterName", "reporterEmail", "category", "description" FROM "client_bug_reports";

DROP TABLE "client_bug_reports";
ALTER TABLE "client_bug_reports_new" RENAME TO "client_bug_reports";

CREATE INDEX "client_bug_reports_clientId_createdAt_idx" ON "client_bug_reports"("clientId", "createdAt");

PRAGMA foreign_keys=ON;
