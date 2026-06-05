import { Prisma } from "@/generated/prisma/client";
import { directPostgresUrlForDdl, runDirectPostgresDdl } from "@/lib/direct-postgres-ddl";
import { prisma } from "@/lib/prisma";

export const TRAINER_SIGNUP_TERMS_DDL = `
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "trainers" ADD COLUMN IF NOT EXISTS "privacyPolicyAcceptedAt" TIMESTAMP(3);
ALTER TABLE "trainers" ALTER COLUMN "termsAcceptedAt" DROP NOT NULL;
`;

export function isMissingTrainerSignupTermsColumnError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  if (
    (message.includes("privacyPolicyAcceptedAt") || message.includes("termsAcceptedAt")) &&
    (message.includes("does not exist") ||
      message.includes("P2022") ||
      message.includes("42703") ||
      message.includes("Null constraint"))
  ) {
    return true;
  }
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code !== "P2022" && e.code !== "P2011") return false;
  const column = (e.meta as { column?: string })?.column ?? "";
  return column.includes("privacyPolicyAcceptedAt") || column.includes("termsAcceptedAt") || message.includes("privacyPolicyAcceptedAt");
}

export async function countTrainerSignupTermsColumns(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS "count"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trainers'
      AND column_name IN ('termsAcceptedAt', 'privacyPolicyAcceptedAt')
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function ensureTrainerSignupTermsSchema(): Promise<void> {
  if ((await countTrainerSignupTermsColumns()) >= 2) {
    return;
  }

  const ddlUrl = directPostgresUrlForDdl();
  if (!ddlUrl) {
    throw new Error(
      "[ensureTrainerSignupTermsSchema] No DIRECT_URL and could not derive a 5432 Postgres URL from DATABASE_URL.",
    );
  }

  await runDirectPostgresDdl(TRAINER_SIGNUP_TERMS_DDL);

  if ((await countTrainerSignupTermsColumns()) < 2) {
    throw new Error(
      "[ensureTrainerSignupTermsSchema] trainers terms/privacy columns still missing after DDL. Set DIRECT_URL on the server and redeploy.",
    );
  }
}
