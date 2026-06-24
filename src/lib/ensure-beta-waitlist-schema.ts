import { Prisma } from "@/generated/prisma/client";
import { directPostgresUrlForDdl, runDirectPostgresDdl } from "@/lib/direct-postgres-ddl";
import { prisma } from "@/lib/prisma";

export const BETA_WAITLIST_COLUMNS = ["invitedBetaPool"] as const;
export const TRAINER_PROFILE_BETA_POOL_COLUMNS = ["virtualOnlyBetaSlot"] as const;

export const BETA_WAITLIST_SCHEMA_DDL = `
ALTER TABLE "public"."trainer_profiles"
  ADD COLUMN IF NOT EXISTS "virtualOnlyBetaSlot" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."beta_trainer_waitlist_entries"
  ADD COLUMN IF NOT EXISTS "invitedBetaPool" TEXT;
`;

/** True when Postgres/Prisma reports beta waitlist pool columns are absent. */
export function isMissingBetaWaitlistColumnError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  const needles = [...BETA_WAITLIST_COLUMNS, ...TRAINER_PROFILE_BETA_POOL_COLUMNS];
  for (const column of needles) {
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
  return needles.some((name) => column.includes(name) || message.includes(name));
}

async function countBetaWaitlistColumns(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'beta_trainer_waitlist_entries' AND column_name = 'invitedBetaPool')
        OR (table_name = 'trainer_profiles' AND column_name = 'virtualOnlyBetaSlot')
      )
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Applies beta waitlist / trainer pool DDL idempotently when production missed
 * `20260611120000_beta_trainer_pools` (wrong TrainerProfile table name).
 */
export async function ensureBetaWaitlistSchema(): Promise<void> {
  const expected = BETA_WAITLIST_COLUMNS.length + TRAINER_PROFILE_BETA_POOL_COLUMNS.length;
  if ((await countBetaWaitlistColumns()) >= expected) {
    return;
  }

  const ddlUrl = directPostgresUrlForDdl();
  if (ddlUrl) {
    await runDirectPostgresDdl(BETA_WAITLIST_SCHEMA_DDL);
  } else {
    throw new Error(
      "[ensureBetaWaitlistSchema] No DIRECT_URL and could not derive a 5432 Postgres URL from DATABASE_URL.",
    );
  }

  const ready = await countBetaWaitlistColumns();
  if (ready < expected) {
    throw new Error(
      `[ensureBetaWaitlistSchema] beta waitlist columns still missing after DDL (${ready}/${expected}). Set DIRECT_URL on the server and redeploy.`,
    );
  }
}
