import { Prisma } from "@/generated/prisma/client";
import { directPostgresUrlForDdl, runDirectPostgresDdl } from "@/lib/direct-postgres-ddl";
import { prisma } from "@/lib/prisma";

const TRAINER_PLATFORM_TRIAL_COLUMNS = [
  "stripeCustomerId",
  "stripeSubscriptionId",
  "stripeSubscriptionActive",
  "subscriptionGraceUntil",
  "platformTrialEndsAt",
  "paymentGraceUntil",
  "platformTrialConsumed",
] as const;

export const TRAINER_PLATFORM_TRIAL_DDL = `
ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "subscriptionGraceUntil" TIMESTAMP(3);
ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "platformTrialEndsAt" TIMESTAMP(3);
ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "paymentGraceUntil" TIMESTAMP(3);
ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "platformTrialConsumed" BOOLEAN NOT NULL DEFAULT false;
`;

/** True when Postgres/Prisma reports trainer platform-trial lifecycle columns are absent. */
export function isMissingTrainerPlatformTrialColumnError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  for (const column of TRAINER_PLATFORM_TRIAL_COLUMNS) {
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
  return TRAINER_PLATFORM_TRIAL_COLUMNS.some((name) => column.includes(name) || message.includes(name));
}

export async function countTrainerPlatformTrialColumns(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trainers'
      AND column_name IN (
        'stripeCustomerId',
        'stripeSubscriptionId',
        'stripeSubscriptionActive',
        'subscriptionGraceUntil',
        'platformTrialEndsAt',
        'paymentGraceUntil',
        'platformTrialConsumed'
      )
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Applies trainer Independent Pro platform-trial DDL idempotently when production
 * missed the dedicated migration.
 */
export async function ensureTrainerPlatformTrialSchema(): Promise<void> {
  if ((await countTrainerPlatformTrialColumns()) >= TRAINER_PLATFORM_TRIAL_COLUMNS.length) {
    return;
  }

  const ddlUrl = directPostgresUrlForDdl();
  if (ddlUrl) {
    await runDirectPostgresDdl(TRAINER_PLATFORM_TRIAL_DDL);
  } else {
    throw new Error(
      "[ensureTrainerPlatformTrialSchema] No DIRECT_URL and could not derive a 5432 Postgres URL from DATABASE_URL.",
    );
  }

  const ready = await countTrainerPlatformTrialColumns();
  if (ready < TRAINER_PLATFORM_TRIAL_COLUMNS.length) {
    throw new Error(
      `[ensureTrainerPlatformTrialSchema] trainers trial columns still missing after DDL (${ready}/${TRAINER_PLATFORM_TRIAL_COLUMNS.length}). Set DIRECT_URL on the server and redeploy.`,
    );
  }
}
