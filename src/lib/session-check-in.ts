import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";
import { ADMIN_FEE_UI_LABEL } from "@/lib/platform-fees";

/** Hours before session start when Gate A UI begins. */
export const CHECK_IN_LEAD_HOURS = 24;

/** Post-session silence window: client Gate A auto-closes without dispute. */
export const GATE_A_POST_SESSION_SILENCE_HOURS = 24;

/** Funds sit in payout buffer until this many hours pass after BOTH Gate A and Gate B timestamps. */
export const PAYOUT_BUFFER_AFTER_BOTH_GATES_HOURS = 48;

/** Fraction of net service+add-on slice refunded when client foregoes after marking an issue (policy). */
export const FOREGO_PARTIAL_REFUND_NET_SLICE = 0.5;

export const NON_REFUNDABLE_FEES_COPY =
  `The Match Fit administrative fee (${ADMIN_FEE_UI_LABEL}), and estimated card processing charges, stay with the processor and are never refunded back to payout math. Ledger amounts shown are net pooled values after those cuts.`;

export function defaultSessionEndAt(args: { scheduledStartAt: Date; scheduledEndAt: Date | null }): Date {
  if (args.scheduledEndAt && args.scheduledEndAt.getTime() > args.scheduledStartAt.getTime()) {
    return args.scheduledEndAt;
  }
  const d = new Date(args.scheduledStartAt);
  d.setHours(d.getHours() + 1);
  return d;
}

export function checkInWindowStartAt(scheduledStartAt: Date): Date {
  const d = new Date(scheduledStartAt);
  d.setHours(d.getHours() - CHECK_IN_LEAD_HOURS);
  return d;
}

/** End of client's post-session window for Gate A (confirm / future dispute escalation). */
export function gateAPostSessionDeadlineAt(args: { scheduledStartAt: Date; scheduledEndAt: Date | null }): Date {
  const end = defaultSessionEndAt(args);
  const d = new Date(end);
  d.setHours(d.getHours() + GATE_A_POST_SESSION_SILENCE_HOURS);
  return d;
}

/** When payouts may leave the disputed buffer when both gates are satisfied and not frozen. */
export function payoutBufferEndsAtFromGates(args: {
  gateASatisfiedAt: Date;
  trainerGateBCompletedAt: Date;
}): Date {
  const t = Math.max(args.gateASatisfiedAt.getTime(), args.trainerGateBCompletedAt.getTime());
  const d = new Date(t);
  d.setHours(d.getHours() + PAYOUT_BUFFER_AFTER_BOTH_GATES_HOURS);
  return d;
}

export type CheckInUiPhase =
  | "hidden"
  | "awaiting_confirm"
  | "upcoming"
  | "gate_a_open_presession"
  | "gate_a_open_postsession"
  | "awaiting_followup"
  | "waiting_trainer_gate_b"
  | "payout_dispute_window"
  | "payout_dispute_frozen"
  | "closed";

export type GateSnapshot = {
  status: string;
  fulfillmentStatus: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date | null;
  gateASatisfiedAt: Date | null;
  gateARevokedBeforeStartAt: Date | null;
  trainerGateBCompletedAt: Date | null;
  payoutBufferEndsAt: Date | null;
  payoutFundsFrozen: boolean;
  disputeOpenedAt: Date | null;
};

/** Client-facing UX phase for bookings (two-gate payout model). */
export function deriveSessionClientUiPhase(snapshot: GateSnapshot, nowParam?: Date): CheckInUiPhase {
  const now = nowParam ?? new Date();

  if (snapshot.status === "INVITED") return "awaiting_confirm";
  if (snapshot.status !== "CLIENT_CONFIRMED") return "hidden";

  const fsClosed = new Set([
    "COMPLETED_LOCKED",
    "AUTO_COMPLETED",
    "CANCELLED_FOREGONE",
    "CANCELLED_RESCHED_DECLINED_BY_CLIENT",
    "CANCELLED_RESCHED_DECLINED_BY_TRAINER",
    "CANCELLED_CLIENT_REVOKE_GATE_A",
    "SESSION_PAYMENT_ROUTE_CLEARED",
  ]);
  if (fsClosed.has(snapshot.fulfillmentStatus)) {
    return "closed";
  }

  if (snapshot.gateARevokedBeforeStartAt) return "closed";
  if (snapshot.disputeOpenedAt || snapshot.payoutFundsFrozen) return "payout_dispute_frozen";

  let fs = snapshot.fulfillmentStatus;
  if (fs === "NONE") fs = "SCHEDULED";

  const windowStart = checkInWindowStartAt(snapshot.scheduledStartAt).getTime();
  const sessionStart = snapshot.scheduledStartAt.getTime();
  const postDeadline = gateAPostSessionDeadlineAt({
    scheduledStartAt: snapshot.scheduledStartAt,
    scheduledEndAt: snapshot.scheduledEndAt,
  }).getTime();

  const bufferEndMs = snapshot.payoutBufferEndsAt?.getTime() ?? null;

  if (snapshot.gateASatisfiedAt && snapshot.trainerGateBCompletedAt && bufferEndMs != null) {
    if (now.getTime() < bufferEndMs && !snapshot.payoutFundsFrozen) {
      return "payout_dispute_window";
    }
    return "closed";
  }

  if (snapshot.gateASatisfiedAt && !snapshot.trainerGateBCompletedAt) {
    return "waiting_trainer_gate_b";
  }

  if (snapshot.fulfillmentStatus === "AWAITING_CLIENT_FOLLOWUP") return "awaiting_followup";

  if (!snapshot.gateASatisfiedAt) {
    if (now.getTime() < windowStart) return "upcoming";
    if (now.getTime() < sessionStart) return "gate_a_open_presession";
    if (now.getTime() < postDeadline) return "gate_a_open_postsession";
    // Post-deadline: cron auto-confirms Gate A; client sees coach must complete Gate B once DB catches up.
    return "waiting_trainer_gate_b";
  }

  return "hidden";
}

export function deriveCheckInUiPhase(args: GateSnapshot & { now?: Date }): CheckInUiPhase {
  const { now, ...snap } = args;
  return deriveSessionClientUiPhase(snap, now);
}

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
