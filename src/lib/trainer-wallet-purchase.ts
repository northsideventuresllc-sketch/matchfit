import "server-only";

import { prisma } from "@/lib/prisma";
import { applyTrainerEarningsDelta } from "@/lib/trainer-earnings-ledger";

export type WalletPurchaseResult = { ok: true } | { ok: false; error: string };

/**
 * Debits the trainer's earnings balance for an in-app purchase. Reused by each purpose-specific
 * route (promo tokens, nudge packs, …) — those routes still call the exact same "apply the
 * purchase" function a Stripe webhook would have called (creditTokensFromStripePurchase,
 * creditFpNudgePackFromCheckout, …), this just replaces the Stripe charge with a wallet debit.
 *
 * Only covers flat, one-time purchase prices today. Registration fee and background check fee
 * have founding-cohort / deferred-fee pricing that varies per trainer — wiring wallet-pay for
 * those needs its own pass, not folded in here. FP tier subscriptions are recurring billing, not
 * a one-time debit, so they're out of scope for wallet-pay entirely. Featured Placement Bid has
 * no real billing yet (see featured-listing/bid/route.ts), so nothing to swap in.
 */
export async function debitTrainerWalletForPurchase(args: {
  trainerId: string;
  amountCents: number;
  metaJson?: string | null;
}): Promise<WalletPurchaseResult> {
  const balance = await prisma.trainerEarningsBalance.findUnique({
    where: { trainerId: args.trainerId },
    select: { balanceCents: true },
  });
  if ((balance?.balanceCents ?? 0) < args.amountCents) {
    return { ok: false, error: "Not enough balance to cover this purchase." };
  }
  try {
    await prisma.$transaction(async (tx) => {
      await applyTrainerEarningsDelta(tx, args.trainerId, -args.amountCents, "WALLET_SPEND", null, args.metaJson);
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && (e as Error & { code?: string }).code === "INSUFFICIENT_EARNINGS_BALANCE") {
      return { ok: false, error: "Not enough balance to cover this purchase." };
    }
    throw e;
  }
}
