import "server-only";

import { getStripe } from "@/lib/stripe-server";
import { prisma } from "@/lib/prisma";
import { applyTrainerEarningsDelta } from "@/lib/trainer-earnings-ledger";

export const MIN_PAYOUT_CENTS = 500;
export const INSTANT_PAYOUT_FEE_CENTS = 199;

export type TrainerPayoutMethod = "INSTANT" | "STANDARD";
export type TrainerPayoutCadence = "ONE_TIME" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

/** The coach eats the transfer fee (JB spec) — standard payouts carry no extra Match Fit fee today. */
export function computePayoutFeeCents(method: TrainerPayoutMethod): number {
  return method === "INSTANT" ? INSTANT_PAYOUT_FEE_CENTS : 0;
}

/** Shared validation for both an on-demand request and a scheduled run. Null = valid. */
export function validatePayoutAmountCents(amountCents: number, availableBalanceCents: number): string | null {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return "Enter an amount to cash out.";
  if (amountCents < MIN_PAYOUT_CENTS) return `Minimum cash-out is $${(MIN_PAYOUT_CENTS / 100).toFixed(2)}.`;
  if (amountCents > availableBalanceCents) return "That's more than your available balance.";
  return null;
}

export type TrainerPayoutRequestResult =
  | { ok: true; payoutRequestId: string; netCents: number; feeCents: number }
  | { ok: false; error: string };

/**
 * Executes one cash-out: debits the earnings ledger, then moves the money via Stripe Connect
 * (platform → connected account transfer, then a payout to the trainer's bank). The ledger debit
 * and the payout-request row are written together; if the Stripe calls fail, the debit is
 * reversed with an explicit REFUND-style credit so the balance never silently vanishes.
 */
export async function requestTrainerPayout(args: {
  trainerId: string;
  amountCents: number;
  method: TrainerPayoutMethod;
  scheduleId?: string | null;
}): Promise<TrainerPayoutRequestResult> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Billing is not configured." };

  const trainer = await prisma.trainer.findUnique({
    where: { id: args.trainerId },
    select: {
      stripeConnectAccountId: true,
      stripeConnectPayoutsEnabled: true,
      earningsBalance: { select: { balanceCents: true } },
    },
  });
  if (!trainer?.stripeConnectAccountId || !trainer.stripeConnectPayoutsEnabled) {
    return { ok: false, error: "Connect a bank account before cashing out." };
  }

  const availableCents = trainer.earningsBalance?.balanceCents ?? 0;
  const amountError = validatePayoutAmountCents(args.amountCents, availableCents);
  if (amountError) return { ok: false, error: amountError };

  const feeCents = computePayoutFeeCents(args.method);
  const netCents = Math.max(0, args.amountCents - feeCents);

  const payoutRequest = await prisma.$transaction(async (tx) => {
    await applyTrainerEarningsDelta(tx, args.trainerId, -args.amountCents, "PAYOUT_WITHDRAWAL", null);
    return tx.trainerPayoutRequest.create({
      data: {
        trainerId: args.trainerId,
        amountCents: args.amountCents,
        method: args.method,
        feeCents,
        netCents,
        status: "PROCESSING",
        scheduleId: args.scheduleId ?? undefined,
      },
    });
  });

  try {
    const transfer = await stripe.transfers.create({
      amount: netCents,
      currency: "usd",
      destination: trainer.stripeConnectAccountId,
      transfer_group: payoutRequest.id,
    });

    const payout = await stripe.payouts.create(
      {
        amount: netCents,
        currency: "usd",
        method: args.method === "INSTANT" ? "instant" : "standard",
      },
      { stripeAccount: trainer.stripeConnectAccountId },
    );

    await prisma.trainerPayoutRequest.update({
      where: { id: payoutRequest.id },
      data: { status: "SENT", stripeTransferId: transfer.id, stripePayoutId: payout.id },
    });

    return { ok: true, payoutRequestId: payoutRequest.id, netCents, feeCents };
  } catch (e) {
    const message = e instanceof Error ? e.message : "The payout could not be sent.";
    await prisma.$transaction(async (tx) => {
      await applyTrainerEarningsDelta(tx, args.trainerId, args.amountCents, "PAYOUT_REVERSED", payoutRequest.id);
      await tx.trainerPayoutRequest.update({
        where: { id: payoutRequest.id },
        data: { status: "FAILED", failureReason: message },
      });
    });
    console.error("[trainer payout] Stripe transfer/payout failed, reversed ledger debit:", e);
    return { ok: false, error: "The payout could not be sent. Your balance has not been charged." };
  }
}

export async function listTrainerPayoutRequests(trainerId: string, limit = 25) {
  return prisma.trainerPayoutRequest.findMany({
    where: { trainerId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function upsertTrainerPayoutSchedule(args: {
  trainerId: string;
  amountCents: number | null;
  method: TrainerPayoutMethod;
  cadence: TrainerPayoutCadence;
  nextRunAt: Date;
}) {
  if (args.amountCents != null && args.amountCents < MIN_PAYOUT_CENTS) {
    throw new Error(`Minimum scheduled cash-out is $${(MIN_PAYOUT_CENTS / 100).toFixed(2)}.`);
  }
  const existing = await prisma.trainerPayoutSchedule.findFirst({
    where: { trainerId: args.trainerId, active: true },
  });
  if (existing) {
    return prisma.trainerPayoutSchedule.update({
      where: { id: existing.id },
      data: {
        amountCents: args.amountCents,
        method: args.method,
        cadence: args.cadence,
        nextRunAt: args.nextRunAt,
      },
    });
  }
  return prisma.trainerPayoutSchedule.create({
    data: {
      trainerId: args.trainerId,
      amountCents: args.amountCents,
      method: args.method,
      cadence: args.cadence,
      nextRunAt: args.nextRunAt,
    },
  });
}

export async function cancelTrainerPayoutSchedule(trainerId: string): Promise<void> {
  await prisma.trainerPayoutSchedule.updateMany({
    where: { trainerId, active: true },
    data: { active: false },
  });
}

function advanceScheduleRun(cadence: TrainerPayoutCadence, from: Date): Date | null {
  const next = new Date(from);
  if (cadence === "ONE_TIME") return null;
  if (cadence === "WEEKLY") next.setUTCDate(next.getUTCDate() + 7);
  else if (cadence === "BIWEEKLY") next.setUTCDate(next.getUTCDate() + 14);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

/** Cron entry point: runs every due, active schedule. Skips (does not fail) a schedule whose payout errors. */
export async function runDueScheduledPayouts(now = new Date()): Promise<number> {
  const due = await prisma.trainerPayoutSchedule.findMany({
    where: { active: true, nextRunAt: { lte: now } },
  });
  let ran = 0;
  for (const schedule of due) {
    const balance = await prisma.trainerEarningsBalance.findUnique({
      where: { trainerId: schedule.trainerId },
      select: { balanceCents: true },
    });
    const amountCents = schedule.amountCents ?? balance?.balanceCents ?? 0;
    if (amountCents >= MIN_PAYOUT_CENTS) {
      await requestTrainerPayout({
        trainerId: schedule.trainerId,
        amountCents,
        method: schedule.method as TrainerPayoutMethod,
        scheduleId: schedule.id,
      });
      ran += 1;
    }
    const nextRunAt = advanceScheduleRun(schedule.cadence as TrainerPayoutCadence, schedule.nextRunAt);
    await prisma.trainerPayoutSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: now,
        active: nextRunAt != null,
        ...(nextRunAt ? { nextRunAt } : {}),
      },
    });
  }
  return ran;
}
