-- Outreach HQ v2 — Cowork Desktop-Control scan jobs (Instagram DM reply scanning).
-- No first-party Instagram API exists, so a Cowork session picks up queued jobs and posts
-- found replies back. Idempotent (IF NOT EXISTS) to match the outreach self-healing DDL in
-- src/lib/ensure-outreach-hub-schema.ts.

CREATE TABLE IF NOT EXISTS "outreach_cowork_scan_jobs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'instagram',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "brief" JSONB NOT NULL,
    "result" JSONB,
    "createdByAdminId" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "outreach_cowork_scan_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "outreach_cowork_scan_jobs_status_createdAt_idx"
  ON "outreach_cowork_scan_jobs"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "outreach_cowork_scan_jobs_platform_status_idx"
  ON "outreach_cowork_scan_jobs"("platform", "status");
