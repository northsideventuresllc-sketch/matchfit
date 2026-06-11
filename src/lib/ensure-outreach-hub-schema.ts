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

/** True when Postgres/Prisma reports outreach hub columns or tables are absent. */
export function isMissingOutreachHubSchemaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (
    message.includes(OUTREACH_HUB_SAVED_AT_COLUMN) ||
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

CREATE INDEX IF NOT EXISTS "outreach_instagram_leads_deletedAt_savedToHubAt_idx"
  ON "outreach_instagram_leads"("deletedAt", "savedToHubAt");
CREATE INDEX IF NOT EXISTS "outreach_facebook_leads_deletedAt_savedToHubAt_idx"
  ON "outreach_facebook_leads"("deletedAt", "savedToHubAt");
CREATE INDEX IF NOT EXISTS "outreach_email_leads_deletedAt_savedToHubAt_idx"
  ON "outreach_email_leads"("deletedAt", "savedToHubAt");
`;

/**
 * Applies outreach HQ DDL idempotently when production missed
 * `20260606120000_outreach_hq` and/or `20260609120000_outreach_hub_saved_at`.
 */
export async function ensureOutreachHubSchema(): Promise<void> {
  if (!(await tableExists(OUTREACH_LEAD_TABLES[0]))) {
    await runOutreachDdl(OUTREACH_HQ_BASE_DDL);
  }

  if ((await countOutreachHubSavedAtColumns()) >= OUTREACH_LEAD_TABLES.length) {
    return;
  }

  await runOutreachDdl(OUTREACH_HUB_SAVED_AT_DDL);

  const ready = await countOutreachHubSavedAtColumns();
  if (ready < OUTREACH_LEAD_TABLES.length) {
    throw new Error(
      `[ensureOutreachHubSchema] savedToHubAt columns still missing after DDL (${ready}/${OUTREACH_LEAD_TABLES.length}). Set DIRECT_URL on the server and redeploy.`,
    );
  }
}
