import { Prisma } from "@/generated/prisma/client";
import { directPostgresUrlForDdl, runDirectPostgresDdl } from "@/lib/direct-postgres-ddl";
import { prisma } from "@/lib/prisma";

const TRAINER_FP_TIER_COLUMNS = [
  "accountTier",
  "tierSwitchedAt",
  "tierSwitchCount",
  "pendingTier",
  "listingStatus",
  "listingPausedAt",
  "billingCycleEnd",
  "gracePeriodEnd",
  "docsSubmitted",
  "docsApproved",
  "docsRejectionCount",
  "docsLastRejectedAt",
  "backgroundCheckPassed",
  "promoteTokensBalance",
  "promoteTokensResetAt",
  "nudgeCreditsBalance",
] as const;

const TRAINER_STRIPE_COLUMNS = ["stripeCustomerId", "stripeSubscriptionId", "stripeSubscriptionActive"] as const;

export const FP_TIER_SCHEMA_DDL = `
ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "stripeSubscriptionActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "externalWebsiteUrl" TEXT;
ALTER TABLE "public"."trainers" ADD COLUMN IF NOT EXISTS "eliteDashboardViewMode" TEXT;

ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "accountTier" TEXT;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "tierSwitchedAt" TIMESTAMP(3);
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "tierSwitchCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "pendingTier" TEXT;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "listingStatus" TEXT NOT NULL DEFAULT 'pending_docs';
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "listingPausedAt" TIMESTAMP(3);
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "billingCycleEnd" TIMESTAMP(3);
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "gracePeriodEnd" TIMESTAMP(3);
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "docsSubmitted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "docsApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "docsRejectionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "docsLastRejectedAt" TIMESTAMP(3);
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "backgroundCheckPassed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "promoteTokensBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "promoteTokensResetAt" TIMESTAMP(3);
ALTER TABLE "public"."trainer_profiles" ADD COLUMN IF NOT EXISTS "nudgeCreditsBalance" INTEGER NOT NULL DEFAULT 0;
`;

/** True when Postgres/Prisma reports FP tier columns are absent (P2022). */
export function isMissingFpTierColumnError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  const needles = [...TRAINER_FP_TIER_COLUMNS, ...TRAINER_STRIPE_COLUMNS];
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

async function countFpTierColumns(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'trainer_profiles' AND column_name IN (
          'accountTier',
          'tierSwitchedAt',
          'tierSwitchCount',
          'pendingTier',
          'listingStatus',
          'listingPausedAt',
          'billingCycleEnd',
          'gracePeriodEnd',
          'docsSubmitted',
          'docsApproved',
          'docsRejectionCount',
          'docsLastRejectedAt',
          'backgroundCheckPassed',
          'promoteTokensBalance',
          'promoteTokensResetAt',
          'nudgeCreditsBalance'
        ))
        OR (table_name = 'trainers' AND column_name IN (
          'stripeCustomerId',
          'stripeSubscriptionId',
          'stripeSubscriptionActive',
          'externalWebsiteUrl',
          'eliteDashboardViewMode'
        ))
      )
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Applies FP tier DDL idempotently when production missed
 * `20260623120000_fp_account_tiers` / `20260623200000_fp_nudge_credits_balance`.
 */
export async function ensureFpTierSchema(): Promise<void> {
  const columnExpected = TRAINER_FP_TIER_COLUMNS.length + TRAINER_STRIPE_COLUMNS.length;
  if ((await countFpTierColumns()) >= columnExpected) {
    return;
  }

  const ddlUrl = directPostgresUrlForDdl();
  if (!ddlUrl) {
    throw new Error(
      "[ensureFpTierSchema] No DIRECT_URL and could not derive a 5432 Postgres URL from DATABASE_URL.",
    );
  }

  await runDirectPostgresDdl(FP_TIER_SCHEMA_DDL);

  const ready = await countFpTierColumns();
  if (ready < columnExpected) {
    throw new Error(
      `[ensureFpTierSchema] FP tier columns still missing after DDL (${ready}/${columnExpected}). Set DIRECT_URL on the server and redeploy.`,
    );
  }
}
