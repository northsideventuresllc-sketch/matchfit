import { Prisma } from "@/generated/prisma/client";
import { directPostgresUrlForDdl, runDirectPostgresDdl } from "@/lib/direct-postgres-ddl";
import { prisma } from "@/lib/prisma";

const CLIENT_PLATFORM_TRIAL_COLUMNS = [
  "platformTrialEndsAt",
  "paymentGraceUntil",
  "accountDeactivatedAt",
  "platformTrialConsumed",
] as const;

export const CLIENT_PLATFORM_TRIAL_DDL = `
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "platformTrialEndsAt" TIMESTAMP(3);
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "paymentGraceUntil" TIMESTAMP(3);
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "accountDeactivatedAt" TIMESTAMP(3);
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "platformTrialConsumed" BOOLEAN NOT NULL DEFAULT false;
`;

/** True when Postgres/Prisma reports client platform-trial lifecycle columns are absent. */
export function isMissingClientPlatformTrialColumnError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  for (const column of CLIENT_PLATFORM_TRIAL_COLUMNS) {
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
  return CLIENT_PLATFORM_TRIAL_COLUMNS.some((name) => column.includes(name) || message.includes(name));
}

export async function countClientPlatformTrialColumns(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name IN (
        'platformTrialEndsAt',
        'paymentGraceUntil',
        'accountDeactivatedAt',
        'platformTrialConsumed'
      )
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Applies client platform-trial DDL idempotently when production missed
 * `20260604120000_client_platform_trial_flow` / `20260604180000_fix_client_platform_trial_columns`.
 *
 * Uses DIRECT_URL when set — Supabase transaction poolers cannot run ALTER TABLE reliably.
 */
export async function ensureClientPlatformTrialSchema(): Promise<void> {
  if ((await countClientPlatformTrialColumns()) >= CLIENT_PLATFORM_TRIAL_COLUMNS.length) {
    return;
  }

  const ddlUrl = directPostgresUrlForDdl();
  if (ddlUrl) {
    await runDirectPostgresDdl(CLIENT_PLATFORM_TRIAL_DDL);
  } else {
    throw new Error(
      "[ensureClientPlatformTrialSchema] No DIRECT_URL and could not derive a 5432 Postgres URL from DATABASE_URL.",
    );
  }

  const ready = await countClientPlatformTrialColumns();
  if (ready < CLIENT_PLATFORM_TRIAL_COLUMNS.length) {
    throw new Error(
      `[ensureClientPlatformTrialSchema] clients trial columns still missing after DDL (${ready}/${CLIENT_PLATFORM_TRIAL_COLUMNS.length}). Set DIRECT_URL on the server and redeploy.`,
    );
  }
}
