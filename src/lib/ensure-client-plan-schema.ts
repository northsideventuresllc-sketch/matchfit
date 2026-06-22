import { Prisma } from "@/generated/prisma/client";
import { directPostgresUrlForDdl, runDirectPostgresDdl } from "@/lib/direct-postgres-ddl";
import { prisma } from "@/lib/prisma";

const CLIENT_PLAN_COLUMNS = [
  "clientPlanTier",
  "vipSubscriptionId",
  "vipSubscriptionActive",
  "freemiumSwipeCount",
  "freemiumSwipeWindowStartAt",
] as const;

export const CLIENT_PLAN_SCHEMA_DDL = `
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "clientPlanTier" TEXT NOT NULL DEFAULT 'FREEMIUM';
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "vipSubscriptionId" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "vipSubscriptionActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "freemiumSwipeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "freemiumSwipeWindowStartAt" TIMESTAMP(3);
`;

/** True when Postgres/Prisma reports client Free/VIP plan columns are absent. */
export function isMissingClientPlanColumnError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  for (const column of CLIENT_PLAN_COLUMNS) {
    if (!message.includes(column)) continue;
    if (
      message.includes("does not exist") ||
      message.includes("P2022") ||
      message.includes("42703")
    ) {
      return true;
    }
  }
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code !== "P2022") return false;
  const column = (e.meta as { column?: string })?.column ?? "";
  return CLIENT_PLAN_COLUMNS.some((name) => column.includes(name) || message.includes(name));
}

export async function countClientPlanColumns(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name IN (
        'clientPlanTier',
        'vipSubscriptionId',
        'vipSubscriptionActive',
        'freemiumSwipeCount',
        'freemiumSwipeWindowStartAt'
      )
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Applies client Free/VIP plan DDL idempotently when production missed
 * `20260619120000_client_freemium_vip_trainer_deferred_fee`.
 */
export async function ensureClientPlanSchema(): Promise<void> {
  if ((await countClientPlanColumns()) >= CLIENT_PLAN_COLUMNS.length) {
    return;
  }

  const ddlUrl = directPostgresUrlForDdl();
  if (ddlUrl) {
    await runDirectPostgresDdl(CLIENT_PLAN_SCHEMA_DDL);
  } else {
    throw new Error(
      "[ensureClientPlanSchema] No DIRECT_URL and could not derive a 5432 Postgres URL from DATABASE_URL.",
    );
  }

  const ready = await countClientPlanColumns();
  if (ready < CLIENT_PLAN_COLUMNS.length) {
    throw new Error(
      `[ensureClientPlanSchema] client plan columns still missing after DDL (${ready}/${CLIENT_PLAN_COLUMNS.length}). Set DIRECT_URL on the server and redeploy.`,
    );
  }
}
