import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { directPostgresUrlForDdl, runDirectPostgresDdl } from "@/lib/direct-postgres-ddl";
import { prisma } from "@/lib/prisma";

const OUTREACH_LEAD_TABLES = [
  "outreach_instagram_leads",
  "outreach_facebook_leads",
  "outreach_email_leads",
] as const;

export const OUTREACH_HUB_SAVED_AT_COLUMN = "savedToHubAt";
export const OUTREACH_ARCHIVE_COLUMNS = ["archivedAt", "deadLeadAt", "archivePurgeAfterAt"] as const;

export const OUTREACH_FOLLOW_UP_COPY_COLUMNS = [
  { table: "outreach_instagram_leads", column: "followUp1DmText" },
  { table: "outreach_email_leads", column: "followUp1EmailSubject" },
] as const;

export const OUTREACH_INTENT_COLUMN = "outreachIntent";

/** True when Postgres/Prisma reports outreach hub columns or tables are absent. */
export function isMissingOutreachHubSchemaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes("[ensureOutreachHubSchema]")) {
    return true;
  }
  const mentionsOutreachColumn =
    message.includes(OUTREACH_HUB_SAVED_AT_COLUMN) ||
    message.includes(OUTREACH_INTENT_COLUMN) ||
    OUTREACH_ARCHIVE_COLUMNS.some((column) => message.includes(column)) ||
    OUTREACH_FOLLOW_UP_COPY_COLUMNS.some(({ column }) => message.includes(column));
  if (
    mentionsOutreachColumn ||
    message.includes("outreach_instagram_leads") ||
    message.includes("outreach_facebook_leads") ||
    message.includes("outreach_email_leads")
  ) {
    if (
      message.includes("does not exist") ||
      message.includes("42P01") ||
      message.includes("42703") ||
      message.includes("P2021") ||
      message.includes("P2022")
    ) {
      return true;
    }
  }
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return e.code === "P2021" || e.code === "P2022";
}

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function countOutreachHubSavedAtColumns(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'outreach_instagram_leads',
        'outreach_facebook_leads',
        'outreach_email_leads'
      )
      AND column_name = 'savedToHubAt'
  `;
  return Number(rows[0]?.count ?? 0);
}

async function runOutreachDdl(sql: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (firstError) {
    const ddlUrl = directPostgresUrlForDdl();
    if (!ddlUrl) throw firstError;
    await runDirectPostgresDdl(sql);
  }
}

const OUTREACH_HQ_BASE_DDL = `
CREATE TABLE IF NOT EXISTS "outreach_instagram_leads" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "handle" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "targetGroup" TEXT NOT NULL,
    "whyMatchFit" TEXT NOT NULL,
    "likelihoodScore" INTEGER NOT NULL DEFAULT 50,
    "notes" TEXT,
    "dmText" TEXT NOT NULL,
    "commentText" TEXT NOT NULL,
    "commentPostRef" TEXT,
    "genericInviteTail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LEAD',
    "autoClassification" TEXT NOT NULL DEFAULT 'ACTIVE_LEAD',
    "outreachSentAt" TIMESTAMP(3),
    "followUp1SentAt" TIMESTAMP(3),
    "followUp2SentAt" TIMESTAMP(3),
    "responseReceivedAt" TIMESTAMP(3),
    "dmTextEdited" BOOLEAN NOT NULL DEFAULT false,
    "commentTextEdited" BOOLEAN NOT NULL DEFAULT false,
    "generationBatchId" TEXT,
    "createdByAdminId" TEXT,
    CONSTRAINT "outreach_instagram_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "outreach_facebook_leads" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "pageName" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'TRAINER',
    "niche" TEXT,
    "targetGroup" TEXT NOT NULL,
    "whyMatchFit" TEXT NOT NULL,
    "likelihoodScore" INTEGER NOT NULL DEFAULT 50,
    "notes" TEXT,
    "pagePostText" TEXT NOT NULL,
    "genericInviteTail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LEAD',
    "autoClassification" TEXT NOT NULL DEFAULT 'ACTIVE_LEAD',
    "outreachSentAt" TIMESTAMP(3),
    "responseReceivedAt" TIMESTAMP(3),
    "pagePostTextEdited" BOOLEAN NOT NULL DEFAULT false,
    "generationBatchId" TEXT,
    "createdByAdminId" TEXT,
    CONSTRAINT "outreach_facebook_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "outreach_email_leads" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "businessName" TEXT,
    "niche" TEXT,
    "emailSourceUrl" TEXT,
    "targetGroup" TEXT NOT NULL,
    "whyMatchFit" TEXT NOT NULL,
    "likelihoodScore" INTEGER NOT NULL DEFAULT 50,
    "notes" TEXT,
    "emailSubject" TEXT NOT NULL,
    "emailBody" TEXT NOT NULL,
    "genericInviteTail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LEAD',
    "autoClassification" TEXT NOT NULL DEFAULT 'ACTIVE_LEAD',
    "outreachSentAt" TIMESTAMP(3),
    "followUp1SentAt" TIMESTAMP(3),
    "followUp2SentAt" TIMESTAMP(3),
    "responseReceivedAt" TIMESTAMP(3),
    "emailBodyEdited" BOOLEAN NOT NULL DEFAULT false,
    "generationBatchId" TEXT,
    "createdByAdminId" TEXT,
    CONSTRAINT "outreach_email_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "outreach_learning_signals" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "leadId" TEXT,
    "originalText" TEXT,
    "editedText" TEXT,
    "outcome" TEXT,
    "metaJson" TEXT,
    CONSTRAINT "outreach_learning_signals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "outreach_daily_templates" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform" TEXT NOT NULL,
    "targetGroup" TEXT NOT NULL,
    "genericInviteTail" TEXT NOT NULL,
    "generationBatchId" TEXT NOT NULL,
    CONSTRAINT "outreach_daily_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_deletedAt_status_createdAt_idx"
  ON "outreach_instagram_leads"("deletedAt", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_handle_idx"
  ON "outreach_instagram_leads"("handle");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_deletedAt_status_createdAt_idx"
  ON "outreach_facebook_leads"("deletedAt", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_pageUrl_idx"
  ON "outreach_facebook_leads"("pageUrl");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_deletedAt_status_createdAt_idx"
  ON "outreach_email_leads"("deletedAt", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_email_idx"
  ON "outreach_email_leads"("email");
CREATE INDEX IF NOT EXISTS "outreach_learning_signals_platform_signalType_createdAt_idx"
  ON "outreach_learning_signals"("platform", "signalType", "createdAt");
CREATE INDEX IF NOT EXISTS "outreach_daily_templates_platform_targetGroup_createdAt_idx"
  ON "outreach_daily_templates"("platform", "targetGroup", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "outreach_daily_templates_generationBatchId_key"
  ON "outreach_daily_templates"("generationBatchId");
`;

const OUTREACH_HUB_SAVED_AT_DDL = `
ALTER TABLE "outreach_instagram_leads"
  ADD COLUMN IF NOT EXISTS "savedToHubAt" TIMESTAMP(3);
ALTER TABLE "outreach_facebook_leads"
  ADD COLUMN IF NOT EXISTS "savedToHubAt" TIMESTAMP(3);
ALTER TABLE "outreach_email_leads"
  ADD COLUMN IF NOT EXISTS "savedToHubAt" TIMESTAMP(3);

ALTER TABLE "outreach_other_leads"
  ADD COLUMN IF NOT EXISTS "savedToHubAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_deletedAt_savedToHubAt_idx"
  ON "outreach_instagram_leads"("deletedAt", "savedToHubAt");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_deletedAt_savedToHubAt_idx"
  ON "outreach_facebook_leads"("deletedAt", "savedToHubAt");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_deletedAt_savedToHubAt_idx"
  ON "outreach_email_leads"("deletedAt", "savedToHubAt");
`;

const OUTREACH_DEAD_LEAD_ARCHIVE_DDL = `
ALTER TABLE "outreach_instagram_leads"
  ADD COLUMN IF NOT EXISTS "deadLeadAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivePurgeAfterAt" TIMESTAMP(3);
ALTER TABLE "outreach_facebook_leads"
  ADD COLUMN IF NOT EXISTS "deadLeadAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivePurgeAfterAt" TIMESTAMP(3);
ALTER TABLE "outreach_email_leads"
  ADD COLUMN IF NOT EXISTS "deadLeadAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivePurgeAfterAt" TIMESTAMP(3);

ALTER TABLE "outreach_learning_signals"
  ADD COLUMN IF NOT EXISTS "adminId" TEXT;

CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_archivedAt_archivePurgeAfterAt_idx"
  ON "outreach_instagram_leads"("archivedAt", "archivePurgeAfterAt");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_archivedAt_archivePurgeAfterAt_idx"
  ON "outreach_facebook_leads"("archivedAt", "archivePurgeAfterAt");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_archivedAt_archivePurgeAfterAt_idx"
  ON "outreach_email_leads"("archivedAt", "archivePurgeAfterAt");
CREATE INDEX IF NOT EXISTS "outreach_learning_signals_adminId_signalType_createdAt_idx"
  ON "outreach_learning_signals"("adminId", "signalType", "createdAt");
`;

const OUTREACH_FOLLOW_UP_COPY_DDL = `
ALTER TABLE "outreach_instagram_leads"
  ADD COLUMN IF NOT EXISTS "followUp1DmText" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "followUp2DmText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "outreach_email_leads"
  ADD COLUMN IF NOT EXISTS "followUp1EmailSubject" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "followUp1EmailBody" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "followUp2EmailSubject" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "followUp2EmailBody" TEXT NOT NULL DEFAULT '';
`;

const OUTREACH_INTENT_DDL = `
ALTER TABLE "outreach_instagram_leads"
  ADD COLUMN IF NOT EXISTS "outreachIntent" TEXT;
ALTER TABLE "outreach_facebook_leads"
  ADD COLUMN IF NOT EXISTS "outreachIntent" TEXT;
ALTER TABLE "outreach_email_leads"
  ADD COLUMN IF NOT EXISTS "outreachIntent" TEXT;
`;

async function countOutreachFollowUpCopyColumns(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'outreach_instagram_leads' AND column_name = 'followUp1DmText')
        OR (table_name = 'outreach_email_leads' AND column_name = 'followUp1EmailSubject')
      )
  `;
  return Number(rows[0]?.count ?? 0);
}

async function countOutreachIntentColumns(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'outreach_instagram_leads',
        'outreach_facebook_leads',
        'outreach_email_leads'
      )
      AND column_name = 'outreachIntent'
  `;
  return Number(rows[0]?.count ?? 0);
}

const OUTREACH_SEND_MODE_DDL = `
ALTER TABLE "outreach_instagram_leads"
  ADD COLUMN IF NOT EXISTS "sendMode" TEXT,
  ADD COLUMN IF NOT EXISTS "manualSentAt" TIMESTAMP(3);
ALTER TABLE "outreach_facebook_leads"
  ADD COLUMN IF NOT EXISTS "sendMode" TEXT,
  ADD COLUMN IF NOT EXISTS "manualSentAt" TIMESTAMP(3);
ALTER TABLE "outreach_email_leads"
  ADD COLUMN IF NOT EXISTS "sendMode" TEXT,
  ADD COLUMN IF NOT EXISTS "manualSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_lane_send_mode_idx"
  ON "outreach_instagram_leads"("outreachLane", "sendMode");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_lane_send_mode_idx"
  ON "outreach_facebook_leads"("outreachLane", "sendMode");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_lane_send_mode_idx"
  ON "outreach_email_leads"("outreachLane", "sendMode");
`;

async function countOutreachSendModeColumns(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'outreach_instagram_leads',
        'outreach_facebook_leads',
        'outreach_email_leads'
      )
      AND column_name = 'sendMode'
  `;
  return Number(rows[0]?.count ?? 0);
}

const OUTREACH_V2_LANES_DDL = `
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

CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_lane_queued_idx"
  ON "outreach_facebook_leads"("deletedAt", "outreachLane", "queuedForDate");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_archivedAt_archiveUiHiddenAfterAt_idx"
  ON "outreach_facebook_leads"("archivedAt", "archiveUiHiddenAfterAt");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_hasUnrespondedReply_idx"
  ON "outreach_facebook_leads"("hasUnrespondedReply");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_dispatchBatchId_idx"
  ON "outreach_facebook_leads"("dispatchBatchId");

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
`;

const OUTREACH_COWORK_SCAN_JOBS_DDL = `
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
`;

async function countOutreachLaneColumns(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'outreach_instagram_leads',
        'outreach_facebook_leads',
        'outreach_email_leads'
      )
      AND column_name = 'outreachLane'
  `;
  return Number(rows[0]?.count ?? 0);
}

async function countOutreachDeadLeadArchiveColumns(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'outreach_instagram_leads',
        'outreach_facebook_leads',
        'outreach_email_leads'
      )
      AND column_name = 'deadLeadAt'
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Applies outreach HQ DDL idempotently when production missed
 * `20260606120000_outreach_hq` and/or `20260609120000_outreach_hub_saved_at`.
 */
export async function ensureOutreachHubSchema(): Promise<void> {
  if (!(await tableExists(OUTREACH_LEAD_TABLES[0]))) {
    await runOutreachDdl(OUTREACH_HQ_BASE_DDL);
  }

  if ((await countOutreachHubSavedAtColumns()) < OUTREACH_LEAD_TABLES.length) {
    await runOutreachDdl(OUTREACH_HUB_SAVED_AT_DDL);
    const savedReady = await countOutreachHubSavedAtColumns();
    if (savedReady < OUTREACH_LEAD_TABLES.length) {
      throw new Error(
        `[ensureOutreachHubSchema] savedToHubAt columns still missing after DDL (${savedReady}/${OUTREACH_LEAD_TABLES.length}). Set DIRECT_URL on the server and redeploy.`,
      );
    }
  }

  if ((await countOutreachDeadLeadArchiveColumns()) < OUTREACH_LEAD_TABLES.length) {
    await runOutreachDdl(OUTREACH_DEAD_LEAD_ARCHIVE_DDL);

    const archiveReady = await countOutreachDeadLeadArchiveColumns();
    if (archiveReady < OUTREACH_LEAD_TABLES.length) {
      throw new Error(
        `[ensureOutreachHubSchema] deadLeadAt columns still missing after DDL (${archiveReady}/${OUTREACH_LEAD_TABLES.length}). Set DIRECT_URL on the server and redeploy.`,
      );
    }
  }

  if ((await countOutreachFollowUpCopyColumns()) < 2) {
    await runOutreachDdl(OUTREACH_FOLLOW_UP_COPY_DDL);

    const followUpReady = await countOutreachFollowUpCopyColumns();
    if (followUpReady < 2) {
      throw new Error(
        `[ensureOutreachHubSchema] follow-up copy columns still missing after DDL (${followUpReady}/2). Set DIRECT_URL on the server and redeploy.`,
      );
    }
  }

  if ((await countOutreachIntentColumns()) < OUTREACH_LEAD_TABLES.length) {
    await runOutreachDdl(OUTREACH_INTENT_DDL);
    const intentReady = await countOutreachIntentColumns();
    if (intentReady < OUTREACH_LEAD_TABLES.length) {
      throw new Error(
        `[ensureOutreachHubSchema] outreachIntent columns still missing after DDL (${intentReady}/${OUTREACH_LEAD_TABLES.length}). Set DIRECT_URL on the server and redeploy.`,
      );
    }
  }

  // v2: lane columns + dispatch batch table (migration 20260723120000_outreach_v2_lanes_and_dispatch).
  if (
    (await countOutreachLaneColumns()) < OUTREACH_LEAD_TABLES.length ||
    !(await tableExists("outreach_cowork_dispatch_batches"))
  ) {
    await runOutreachDdl(OUTREACH_V2_LANES_DDL);
    const laneReady = await countOutreachLaneColumns();
    if (laneReady < OUTREACH_LEAD_TABLES.length) {
      throw new Error(
        `[ensureOutreachHubSchema] outreachLane columns still missing after DDL (${laneReady}/${OUTREACH_LEAD_TABLES.length}). Set DIRECT_URL on the server and redeploy.`,
      );
    }
  }

  // v2: Cowork scan jobs table (migration 20260723130000_outreach_cowork_scan_jobs).
  if (!(await tableExists("outreach_cowork_scan_jobs"))) {
    await runOutreachDdl(OUTREACH_COWORK_SCAN_JOBS_DDL);
  }

  // Send Queue: manual vs. agent send tracking (migration 20260831120000_outreach_send_mode).
  if ((await countOutreachSendModeColumns()) < OUTREACH_LEAD_TABLES.length) {
    await runOutreachDdl(OUTREACH_SEND_MODE_DDL);
    const sendModeReady = await countOutreachSendModeColumns();
    if (sendModeReady < OUTREACH_LEAD_TABLES.length) {
      throw new Error(
        `[ensureOutreachHubSchema] sendMode columns still missing after DDL (${sendModeReady}/${OUTREACH_LEAD_TABLES.length}). Set DIRECT_URL on the server and redeploy.`,
      );
    }
  }
}
