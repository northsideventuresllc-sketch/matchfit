import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const CLIENT_PLATFORM_TRIAL_COLUMNS = [
  "platformTrialEndsAt",
  "paymentGraceUntil",
  "accountDeactivatedAt",
  "platformTrialConsumed",
] as const;

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

/**
 * Applies client platform-trial DDL idempotently when production missed
 * `20260604120000_client_platform_trial_flow` / `20260604180000_fix_client_platform_trial_columns`.
 */
export async function ensureClientPlatformTrialSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`
ALTER TABLE "clients"
ADD COLUMN IF NOT EXISTS "platformTrialEndsAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paymentGraceUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "accountDeactivatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "platformTrialConsumed" BOOLEAN NOT NULL DEFAULT false;
`);
}
