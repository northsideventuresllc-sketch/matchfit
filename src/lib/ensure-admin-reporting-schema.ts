import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function ensureAdminReportingSchema(): Promise<void> {
  const tables = [
    "platform_revenue_events",
    "administrator_audit_logs",
    "site_analytics_events",
    "admin_dashboard_preferences",
    "admin_goals",
    "admin_ai_messages",
  ];
  for (const table of tables) {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${table}
      ) AS "exists"
    `;
    if (rows[0]?.exists) continue;
    await applyMissingTableDdl(table);
  }
}

async function applyMissingTableDdl(table: string): Promise<void> {
  if (table === "site_analytics_events") {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "site_analytics_events" (
  "id" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "kind" TEXT NOT NULL, "path" TEXT NOT NULL, "targetPath" TEXT, "targetUrl" TEXT,
  "linkLabel" TEXT, "visitorId" TEXT NOT NULL, "sessionId" TEXT NOT NULL,
  CONSTRAINT "site_analytics_events_pkey" PRIMARY KEY ("id")
);`);
    return;
  }
  if (table === "admin_dashboard_preferences") {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "admin_dashboard_preferences" (
  "id" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
  "administratorId" TEXT NOT NULL, "widgetsJson" TEXT NOT NULL,
  CONSTRAINT "admin_dashboard_preferences_pkey" PRIMARY KEY ("id")
);`);
    return;
  }
  if (table === "admin_goals") {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "admin_goals" (
  "id" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "administratorId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT, "targetMetric" TEXT,
  "targetValue" INTEGER, "deadline" TIMESTAMP(3), "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "admin_goals_pkey" PRIMARY KEY ("id")
);`);
    return;
  }
  if (table === "admin_ai_messages") {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "admin_ai_messages" (
  "id" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "administratorId" TEXT NOT NULL, "role" TEXT NOT NULL, "content" TEXT NOT NULL,
  "actionType" TEXT, CONSTRAINT "admin_ai_messages_pkey" PRIMARY KEY ("id")
);`);
  }
}

export function isMissingAdminReportingTableError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  const needles = [
    "platform_revenue_events",
    "site_analytics_events",
    "administrator_audit_logs",
    "admin_dashboard_preferences",
  ];
  if (needles.some((n) => message.includes(n) && message.includes("does not exist"))) return true;
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return e.code === "P2021";
}
