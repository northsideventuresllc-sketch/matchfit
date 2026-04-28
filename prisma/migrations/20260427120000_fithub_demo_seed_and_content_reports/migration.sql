-- Idempotent FitHub demo posts + client content reports

ALTER TABLE "trainer_fit_hub_posts" ADD COLUMN "demoSeedKey" TEXT;

CREATE UNIQUE INDEX "trainer_fit_hub_posts_demoSeedKey_key" ON "trainer_fit_hub_posts"("demoSeedKey");

CREATE TABLE "trainer_fit_hub_post_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "trainer_fit_hub_post_reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "trainer_fit_hub_posts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trainer_fit_hub_post_reports_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "trainer_fit_hub_post_reports_postId_clientId_key" ON "trainer_fit_hub_post_reports"("postId", "clientId");
CREATE INDEX "trainer_fit_hub_post_reports_status_createdAt_idx" ON "trainer_fit_hub_post_reports"("status", "createdAt");
