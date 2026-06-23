import type { Prisma } from "@/generated/prisma/client";
import type { FpAccountTier } from "@/lib/fp-account-tier-types";
import { getFpTierPermissions } from "@/lib/fp-tier-permissions";

export const FP_PROMOTE_TOKEN_PURCHASE_USD_CENTS = 200;

type Tx = Prisma.TransactionClient;

export async function creditFpPromoteTokens(
  tx: Tx,
  trainerId: string,
  amount: number,
  action: "credited" | "purchased",
  referenceId?: string | null,
): Promise<void> {
  if (amount <= 0) return;
  const profile = await tx.trainerProfile.findUnique({
    where: { trainerId },
    select: { promoteTokensBalance: true },
  });
  const next = (profile?.promoteTokensBalance ?? 0) + amount;
  await tx.trainerProfile.update({
    where: { trainerId },
    data: { promoteTokensBalance: next },
  });
  await tx.fpPromoteTokenLedger.create({
    data: {
      trainerId,
      action,
      amount,
      referenceId: referenceId ?? undefined,
    },
  });
}

export async function spendFpPromoteToken(
  tx: Tx,
  trainerId: string,
  referenceId?: string | null,
): Promise<void> {
  const profile = await tx.trainerProfile.findUnique({
    where: { trainerId },
    select: { promoteTokensBalance: true },
  });
  const balance = profile?.promoteTokensBalance ?? 0;
  if (balance < 1) {
    const err = new Error("INSUFFICIENT_PROMOTE_TOKENS");
    (err as Error & { code: string }).code = "INSUFFICIENT_PROMOTE_TOKENS";
    throw err;
  }
  await tx.trainerProfile.update({
    where: { trainerId },
    data: { promoteTokensBalance: balance - 1 },
  });
  await tx.fpPromoteTokenLedger.create({
    data: {
      trainerId,
      action: "spent",
      amount: 1,
      referenceId: referenceId ?? undefined,
    },
  });
}

export async function expireUnusedFpPromoteTokens(tx: Tx, trainerId: string): Promise<number> {
  const profile = await tx.trainerProfile.findUnique({
    where: { trainerId },
    select: { promoteTokensBalance: true },
  });
  const balance = profile?.promoteTokensBalance ?? 0;
  if (balance <= 0) return 0;
  await tx.trainerProfile.update({
    where: { trainerId },
    data: { promoteTokensBalance: 0, promoteTokensResetAt: new Date() },
  });
  await tx.fpPromoteTokenLedger.create({
    data: {
      trainerId,
      action: "expired",
      amount: balance,
    },
  });
  return balance;
}

export function fpMonthlyPromoteTokenGrant(tier: FpAccountTier | null | undefined): number {
  if (!tier) return 0;
  return getFpTierPermissions(tier)?.promote_tokens_monthly ?? 0;
}

export async function applyFpMonthlyPromoteTokenGrant(
  tx: Tx,
  trainerId: string,
  tier: FpAccountTier,
  referenceId: string,
): Promise<void> {
  const grant = fpMonthlyPromoteTokenGrant(tier);
  if (grant <= 0) return;
  await expireUnusedFpPromoteTokens(tx, trainerId);
  await creditFpPromoteTokens(tx, trainerId, grant, "credited", referenceId);
}
