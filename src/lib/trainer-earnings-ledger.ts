import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type TrainerEarningsLedgerReason =
  | "SESSION_PAYOUT_CLEARED"
  | "SERVICE_SALE_CLEARED"
  | "PAYOUT_WITHDRAWAL"
  | "PAYOUT_REVERSED"
  | "WALLET_SPEND"
  | "ADMIN_ADJUST"
  | "REFUND_CLAWBACK";

type Tx = Prisma.TransactionClient;

/**
 * Applies a signed cents delta to a trainer's cash-earnings balance and appends the matching
 * ledger entry, inside the caller's transaction. Mirrors `applyTrainerTokenDelta` in
 * trainer-promo-tokens.ts. Throws INSUFFICIENT_EARNINGS_BALANCE rather than letting a debit
 * take the balance negative.
 */
export async function applyTrainerEarningsDelta(
  tx: Tx,
  trainerId: string,
  deltaCents: number,
  reason: TrainerEarningsLedgerReason,
  referenceKey: string | null,
  metaJson?: string | null,
): Promise<void> {
  if (deltaCents === 0) return;
  const prev = await tx.trainerEarningsBalance.findUnique({
    where: { trainerId },
    select: { balanceCents: true },
  });
  const next = (prev?.balanceCents ?? 0) + deltaCents;
  if (next < 0) {
    const err = new Error("INSUFFICIENT_EARNINGS_BALANCE");
    (err as Error & { code: string }).code = "INSUFFICIENT_EARNINGS_BALANCE";
    throw err;
  }
  await tx.trainerEarningsBalance.upsert({
    where: { trainerId },
    create: { trainerId, balanceCents: next },
    update: { balanceCents: next },
  });
  await tx.trainerEarningsLedgerEntry.create({
    data: {
      trainerId,
      deltaCents,
      reason,
      referenceKey: referenceKey ?? undefined,
      metaJson: metaJson ?? undefined,
    },
  });
}

/**
 * Idempotent credit: skips silently if a ledger entry already exists for this
 * (trainerId, reason, referenceKey) — safe to call from a cron/webhook that may retry.
 * `referenceKey` should always be set for credits (e.g. a bookedTrainingSessionId) so the
 * same source event can never post twice, even without relying on the DB unique constraint.
 */
export async function creditTrainerEarningsIfNotAlready(
  tx: Tx,
  trainerId: string,
  deltaCents: number,
  reason: TrainerEarningsLedgerReason,
  referenceKey: string,
  metaJson?: string | null,
): Promise<void> {
  if (deltaCents <= 0) return;
  const dup = await tx.trainerEarningsLedgerEntry.findFirst({
    where: { trainerId, reason, referenceKey },
    select: { id: true },
  });
  if (dup) return;
  await applyTrainerEarningsDelta(tx, trainerId, deltaCents, reason, referenceKey, metaJson);
}

export async function getTrainerEarningsBalanceCents(trainerId: string): Promise<number> {
  const row = await prisma.trainerEarningsBalance.findUnique({
    where: { trainerId },
    select: { balanceCents: true },
  });
  return row?.balanceCents ?? 0;
}
