import { prisma } from "@/lib/prisma";
import { ADMIN_FEE_UI_LABEL } from "@/lib/platform-fees";
import { getStripe } from "@/lib/stripe-server";

export * from "./session-check-in-timing";

export const NON_REFUNDABLE_FEES_COPY =
  `The Match Fit administrative fee (${ADMIN_FEE_UI_LABEL}), and estimated card processing charges, stay with the processor and are never refunded back to payout math. Ledger amounts shown are net pooled values after those cuts.`;

export async function computeAverageCoachServiceCentsPerCredit(args: {
  trainerId: string;
  clientId: string;
}): Promise<number> {
  const row = await prisma.trainerClientServiceTransaction.findFirst({
    where: {
      trainerId: args.trainerId,
      clientId: args.clientId,
      bookingUnlimitedPurchase: false,
      sessionCreditsGranted: { gt: 0 },
      ledgerPerServiceUnitNetCents: { not: null },
    },
    orderBy: { completedAt: "desc" },
    select: { ledgerPerServiceUnitNetCents: true },
  });
  if (row?.ledgerPerServiceUnitNetCents != null && row.ledgerPerServiceUnitNetCents >= 0) {
    return row.ledgerPerServiceUnitNetCents;
  }

  const txs = await prisma.trainerClientServiceTransaction.findMany({
    where: {
      trainerId: args.trainerId,
      clientId: args.clientId,
      bookingUnlimitedPurchase: false,
      sessionCreditsGranted: { gt: 0 },
    },
    select: { amountCents: true, sessionCreditsGranted: true },
  });
  let sum = 0;
  let credits = 0;
  for (const t of txs) {
    sum += Math.max(0, t.amountCents);
    credits += Math.max(0, t.sessionCreditsGranted);
  }
  if (credits <= 0) return 0;
  return Math.floor(sum / credits);
}

export async function refundCentsViaStripePaymentIntent(args: {
  paymentIntentId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<{ ok: true; refundId: string } | { error: string }> {
  if (args.amountCents <= 0) {
    return { error: "Refund amount must be positive." };
  }
  const stripe = getStripe();
  if (!stripe) {
    return { error: "Billing is not configured." };
  }
  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: args.paymentIntentId,
        amount: args.amountCents,
      },
      { idempotencyKey: args.idempotencyKey.slice(0, 255) },
    );
    return { ok: true, refundId: refund.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

export async function findServiceTransactionForStripeRefund(args: {
  trainerId: string;
  clientId: string;
}): Promise<{
  id: string;
  stripePaymentIntentId: string | null;
  amountCents: number;
  adminFeeCents: number | null;
  totalChargedCents: number | null;
} | null> {
  const row = await prisma.trainerClientServiceTransaction.findFirst({
    where: {
      trainerId: args.trainerId,
      clientId: args.clientId,
      stripePaymentIntentId: { not: null },
    },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      stripePaymentIntentId: true,
      amountCents: true,
      adminFeeCents: true,
      totalChargedCents: true,
    },
  });
  return row;
}
