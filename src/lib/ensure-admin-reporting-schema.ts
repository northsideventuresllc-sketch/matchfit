import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** True when Postgres/Prisma reports the admin reporting ledger tables are absent. */
export function isMissingAdminReportingTableError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (
    message.includes("platform_revenue_events") ||
    message.includes("administrator_audit_logs") ||
    message.includes("site_analytics_events")
  ) {
    if (
      message.includes("does not exist") ||
      message.includes("42P01") ||
      message.includes("P2021") ||
      message.includes("P2010")
    ) {
      return true;
    }
  }
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === "P2021") return true;
  const table = (e.meta as { table?: string })?.table ?? "";
  return (
    table === "public.platform_revenue_events" ||
    table === "public.administrator_audit_logs" ||
    table === "public.site_analytics_events"
  );
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

async function ensurePlatformRevenueAndAuditTables(): Promise<void> {
  if (await tableExists("platform_revenue_events")) return;

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "administrator_audit_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "administratorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetUsername" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "administrator_audit_logs_pkey" PRIMARY KEY ("id")
);
`);

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "platform_revenue_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "revenueCents" INTEGER NOT NULL,
    "grossProfitCents" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "clientId" TEXT,
    "trainerId" TEXT,
    "metaJson" TEXT,
    CONSTRAINT "platform_revenue_events_pkey" PRIMARY KEY ("id")
);
`);

  await prisma.$executeRawUnsafe(`
CREATE UNIQUE INDEX IF NOT EXISTS "platform_revenue_events_idempotencyKey_key"
  ON "platform_revenue_events"("idempotencyKey");
`);

  await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "administrator_audit_logs_administratorId_createdAt_idx"
  ON "administrator_audit_logs"("administratorId", "createdAt");
`);

  await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "administrator_audit_logs_targetRole_targetId_createdAt_idx"
  ON "administrator_audit_logs"("targetRole", "targetId", "createdAt");
`);

  await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "platform_revenue_events_category_createdAt_idx"
  ON "platform_revenue_events"("category", "createdAt");
`);

  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  ALTER TABLE "administrator_audit_logs"
    ADD CONSTRAINT "administrator_audit_logs_administratorId_fkey"
    FOREIGN KEY ("administratorId") REFERENCES "administrators"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`);
}

async function ensureSiteAnalyticsTable(): Promise<void> {
  if (await tableExists("site_analytics_events")) return;

  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "site_analytics_events" (
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
`);

  await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "site_analytics_events_createdAt_idx"
  ON "site_analytics_events"("createdAt");
`);

  await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "site_analytics_events_kind_createdAt_idx"
  ON "site_analytics_events"("kind", "createdAt");
`);

  await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "site_analytics_events_path_createdAt_idx"
  ON "site_analytics_events"("path", "createdAt");
`);

  await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "site_analytics_events_visitorId_createdAt_idx"
  ON "site_analytics_events"("visitorId", "createdAt");
`);
}

/**
 * Applies admin dashboard DDL idempotently when production missed pending migrations
 * (`20260527160000_admin_audit_platform_revenue`, `20260528120000_site_analytics_events`).
 */
export async function ensureAdminReportingSchema(): Promise<void> {
  await ensurePlatformRevenueAndAuditTables();
  await ensureSiteAnalyticsTable();
}
