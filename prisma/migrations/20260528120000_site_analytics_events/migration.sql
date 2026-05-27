-- First-party site traffic for administrator reporting.

CREATE TABLE "site_analytics_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "targetPath" TEXT,
    "targetUrl" TEXT,
    "linkLabel" TEXT,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "site_analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "site_analytics_events_createdAt_idx" ON "site_analytics_events"("createdAt");

CREATE INDEX "site_analytics_events_kind_createdAt_idx" ON "site_analytics_events"("kind", "createdAt");

CREATE INDEX "site_analytics_events_path_createdAt_idx" ON "site_analytics_events"("path", "createdAt");

CREATE INDEX "site_analytics_events_visitorId_createdAt_idx" ON "site_analytics_events"("visitorId", "createdAt");
