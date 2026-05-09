CREATE TABLE "product_idea_submissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT,
    "trainerId" TEXT,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "reporterName" TEXT,
    "reporterEmail" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "product_idea_submissions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_idea_submissions_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "product_idea_submissions_clientId_createdAt_idx" ON "product_idea_submissions"("clientId", "createdAt");
CREATE INDEX "product_idea_submissions_trainerId_createdAt_idx" ON "product_idea_submissions"("trainerId", "createdAt");
