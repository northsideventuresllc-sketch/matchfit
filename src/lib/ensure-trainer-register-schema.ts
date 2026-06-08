import { Prisma } from "@/generated/prisma/client";
import { directPostgresUrlForDdl, runDirectPostgresDdl } from "@/lib/direct-postgres-ddl";
import { prisma } from "@/lib/prisma";

const TRAINER_REGISTER_PROFILE_COLUMNS = [
  "limitedDashboardUnlockedAt",
  "onboardingFeePaymentDeadlineAt",
  "onboardingFeePaymentExpiredAt",
  "complianceWindowStartedAt",
  "complianceWindowPausedAt",
  "complianceCertReuploadDeadlineAt",
  "complianceHumanReviewDeadlineAt",
  "complianceCertFailedAttempts",
  "complianceWindowExpiredAt",
  "registrationFeeHoldPaymentIntentId",
  "registrationFeeHoldStatus",
  "fitHubPromoEndsAt",
  "backgroundCheckInviteRequestedAt",
  "backgroundCheckInviteSentAt",
  "backgroundCheckEscrowCents",
  "platformEscrowCents",
] as const;

export const TRAINER_REGISTER_PROFILE_COLUMNS_REQUIRED = TRAINER_REGISTER_PROFILE_COLUMNS.length;

export const TRAINER_REGISTER_SCHEMA_DDL = `
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "limitedDashboardUnlockedAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "onboardingFeePaymentDeadlineAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "onboardingFeePaymentExpiredAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "complianceWindowStartedAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "complianceWindowPausedAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "complianceCertReuploadDeadlineAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "complianceHumanReviewDeadlineAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "complianceCertFailedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "complianceWindowExpiredAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "registrationFeeHoldPaymentIntentId" TEXT;
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "registrationFeeHoldStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "fitHubPromoEndsAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "backgroundCheckInviteRequestedAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "backgroundCheckInviteSentAt" TIMESTAMP(3);
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "backgroundCheckEscrowCents" INTEGER;
ALTER TABLE "trainer_profiles" ADD COLUMN IF NOT EXISTS "platformEscrowCents" INTEGER;
ALTER TABLE "trainers" ALTER COLUMN "termsAcceptedAt" DROP NOT NULL;
`;

export function isMissingTrainerRegisterSchemaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (
    message.includes("termsAcceptedAt") &&
    (message.includes("Null constraint") ||
      message.includes("null value") ||
      message.includes("23502") ||
      message.includes("NOT NULL"))
  ) {
    return true;
  }
  for (const column of TRAINER_REGISTER_PROFILE_COLUMNS) {
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
  if (e.code === "P2011" || e.code === "P2012") return true;
  if (e.code !== "P2022") return false;
  const column = (e.meta as { column?: string })?.column ?? "";
  return (
    column.includes("termsAcceptedAt") ||
    TRAINER_REGISTER_PROFILE_COLUMNS.some((name) => column.includes(name) || message.includes(name))
  );
}

export async function countTrainerRegisterProfileColumns(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trainer_profiles'
      AND column_name IN (
        'limitedDashboardUnlockedAt',
        'onboardingFeePaymentDeadlineAt',
        'onboardingFeePaymentExpiredAt',
        'complianceWindowStartedAt',
        'complianceWindowPausedAt',
        'complianceCertReuploadDeadlineAt',
        'complianceHumanReviewDeadlineAt',
        'complianceCertFailedAttempts',
        'complianceWindowExpiredAt',
        'registrationFeeHoldPaymentIntentId',
        'registrationFeeHoldStatus',
        'fitHubPromoEndsAt',
        'backgroundCheckInviteRequestedAt',
        'backgroundCheckInviteSentAt',
        'backgroundCheckEscrowCents',
        'platformEscrowCents'
      )
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function isTrainerTermsAcceptedAtNullable(): Promise<boolean | null> {
  const rows = await prisma.$queryRaw<{ is_nullable: string }[]>`
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trainers'
      AND column_name = 'termsAcceptedAt'
    LIMIT 1
  `;
  const value = rows[0]?.is_nullable;
  if (!value) return null;
  return value.toUpperCase() === "YES";
}

/**
 * Applies trainer signup DDL idempotently when production missed
 * `20260603120000_trainer_compliance_window_signup_hold` or
 * `20260603120000_background_check_plan_b`.
 */
export async function ensureTrainerRegisterSchema(): Promise<void> {
  const [profileColumns, termsNullable] = await Promise.all([
    countTrainerRegisterProfileColumns(),
    isTrainerTermsAcceptedAtNullable(),
  ]);
  if (profileColumns >= TRAINER_REGISTER_PROFILE_COLUMNS.length && termsNullable === true) {
    return;
  }

  const ddlUrl = directPostgresUrlForDdl();
  if (!ddlUrl) {
    throw new Error(
      "[ensureTrainerRegisterSchema] No DIRECT_URL and could not derive a 5432 Postgres URL from DATABASE_URL.",
    );
  }

  await runDirectPostgresDdl(TRAINER_REGISTER_SCHEMA_DDL);

  const [readyColumns, readyTermsNullable] = await Promise.all([
    countTrainerRegisterProfileColumns(),
    isTrainerTermsAcceptedAtNullable(),
  ]);
  if (readyColumns < TRAINER_REGISTER_PROFILE_COLUMNS.length || readyTermsNullable !== true) {
    throw new Error(
      `[ensureTrainerRegisterSchema] trainer signup schema still incomplete after DDL (profileColumns=${readyColumns}/${TRAINER_REGISTER_PROFILE_COLUMNS.length}, termsAcceptedAtNullable=${String(readyTermsNullable)}). Set DIRECT_URL on the server and redeploy.`,
    );
  }
}
