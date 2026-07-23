-- Outreach HQ v2 (8-tab restructure): lead "lanes", past-due tracking, follow-up
-- reminder timestamps, archive UI-hide window (hide, never delete), pending-response
-- drafts, and Prisma-tracked Cowork dispatch batches.
--
-- Idempotent (IF NOT EXISTS) to stay consistent with the outreach self-healing DDL in
-- src/lib/ensure-outreach-hub-schema.ts and the existing outreach migrations.

-- Instagram leads (has follow-up pipeline)
ALTER TABLE "outreach_instagram_leads"
  ADD COLUMN IF NOT EXISTS "outreachLane" TEXT NOT NULL DEFAULT 'today',
  ADD COLUMN IF NOT EXISTS "queuedForDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "followUp1DueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "followUp1LastRemindedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "followUp2DueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "followUp2LastRemindedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archiveUiHiddenAfterAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hasUnrespondedReply" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "replyReceivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pendingResponseDraft" TEXT,
  ADD COLUMN IF NOT EXISTS "pendingResponseDraftAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispatchBatchId" TEXT,
  ADD COLUMN IF NOT EXISTS "dispatchPreviousLane" TEXT;

-- Facebook leads (page posts: no follow-up pipeline, so no follow_up_* columns)
ALTER TABLE "outreach_facebook_leads"
  ADD COLUMN IF NOT EXISTS "outreachLane" TEXT NOT NULL DEFAULT 'today',
  ADD COLUMN IF NOT EXISTS "queuedForDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archiveUiHiddenAfterAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hasUnrespondedReply" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "replyReceivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pendingResponseDraft" TEXT,
  ADD COLUMN IF NOT EXISTS "pendingResponseDraftAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispatchBatchId" TEXT,
  ADD COLUMN IF NOT EXISTS "dispatchPreviousLane" TEXT;

-- Email leads (has follow-up pipeline)
ALTER TABLE "outreach_email_leads"
  ADD COLUMN IF NOT EXISTS "outreachLane" TEXT NOT NULL DEFAULT 'today',
  ADD COLUMN IF NOT EXISTS "queuedForDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "followUp1DueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "followUp1LastRemindedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "followUp2DueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "followUp2LastRemindedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archiveUiHiddenAfterAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hasUnrespondedReply" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "replyReceivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pendingResponseDraft" TEXT,
  ADD COLUMN IF NOT EXISTS "pendingResponseDraftAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispatchBatchId" TEXT,
  ADD COLUMN IF NOT EXISTS "dispatchPreviousLane" TEXT;

-- Indexes: Instagram
CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_lane_queued_idx"
  ON "outreach_instagram_leads"("deletedAt", "outreachLane", "queuedForDate");
CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_outreachLane_followUp1DueAt_idx"
  ON "outreach_instagram_leads"("outreachLane", "followUp1DueAt");
CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_outreachLane_followUp2DueAt_idx"
  ON "outreach_instagram_leads"("outreachLane", "followUp2DueAt");
CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_archivedAt_archiveUiHiddenAfterAt_idx"
  ON "outreach_instagram_leads"("archivedAt", "archiveUiHiddenAfterAt");
CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_hasUnrespondedReply_idx"
  ON "outreach_instagram_leads"("hasUnrespondedReply");
CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_dispatchBatchId_idx"
  ON "outreach_instagram_leads"("dispatchBatchId");

-- Indexes: Facebook
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_lane_queued_idx"
  ON "outreach_facebook_leads"("deletedAt", "outreachLane", "queuedForDate");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_archivedAt_archiveUiHiddenAfterAt_idx"
  ON "outreach_facebook_leads"("archivedAt", "archiveUiHiddenAfterAt");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_hasUnrespondedReply_idx"
  ON "outreach_facebook_leads"("hasUnrespondedReply");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_dispatchBatchId_idx"
  ON "outreach_facebook_leads"("dispatchBatchId");

-- Indexes: Email
CREATE INDEX IF NOT EXISTS "outreach_email_leads_deletedAt_outreachLane_queuedForDate_idx"
  ON "outreach_email_leads"("deletedAt", "outreachLane", "queuedForDate");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_outreachLane_followUp1DueAt_idx"
  ON "outreach_email_leads"("outreachLane", "followUp1DueAt");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_outreachLane_followUp2DueAt_idx"
  ON "outreach_email_leads"("outreachLane", "followUp2DueAt");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_archivedAt_archiveUiHiddenAfterAt_idx"
  ON "outreach_email_leads"("archivedAt", "archiveUiHiddenAfterAt");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_hasUnrespondedReply_idx"
  ON "outreach_email_leads"("hasUnrespondedReply");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_dispatchBatchId_idx"
  ON "outreach_email_leads"("dispatchBatchId");

-- Cowork dispatch batches (Prisma-tracked)
CREATE TABLE IF NOT EXISTS "outreach_cowork_dispatch_batches" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "slot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "leadRefs" JSONB,
    "brief" JSONB NOT NULL,
    "result" JSONB,
    "createdByAdminId" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "outreach_cowork_dispatch_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "outreach_cowork_dispatch_batches_status_scheduledFor_idx"
  ON "outreach_cowork_dispatch_batches"("status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "outreach_cowork_dispatch_batches_scheduledFor_idx"
  ON "outreach_cowork_dispatch_batches"("scheduledFor");
