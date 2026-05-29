/**
 * Founding coach sales bonus: first N trainers (default 30) earn 5% of gross checkout
 * back on their first M app sales (default 5) through end of 2026.
 */

import type { Prisma } from "@/generated/prisma/client";
import type { CheckoutLedgerSplits } from "@/lib/financial-ledger-split";
import {
  getFoundingTrainerSalesBonusMaxSales,
  getFoundingTrainerSalesBonusMaxTrainers,
  getFoundingTrainerSalesBonusPercent,
  isFoundingTrainerBySignupRank,
  isFoundingTrainerSalesBonusEligibleDate,
} from "@/lib/match-fit-launch-promotions";
import { prisma } from "@/lib/prisma";

export type FoundingSalesBonusPlan = {
  bonusCents: number;
  saleNumber: number | null;
};

export function computeFoundingSalesBonusCents(args: {
  totalChargedCents?: number | null;
  amountCents: number;
  adminFeeCents?: number | null;
}): number {
  const base =
    args.totalChargedCents ??
    args.amountCents + Math.max(0, args.adminFeeCents ?? 0);
  if (base <= 0) return 0;
  return Math.round(base * (getFoundingTrainerSalesBonusPercent() / 100));
}

export function applyFoundingSalesBonusToLedger(
  ledger: CheckoutLedgerSplits,
  bonusCents: number,
): CheckoutLedgerSplits {
  if (bonusCents <= 0) return ledger;
  const ledgerNetAfterFeesCents = (ledger.ledgerNetAfterFeesCents ?? 0) + bonusCents;
  const ledgerNetServicePoolCents = (ledger.ledgerNetServicePoolCents ?? 0) + bonusCents;
  const serviceUnits = Math.max(1, ledger.ledgerTotalServiceUnits ?? 1);
  return {
    ...ledger,
    ledgerNetAfterFeesCents,
    ledgerNetServicePoolCents,
    ledgerPerServiceUnitNetCents: Math.floor(ledgerNetServicePoolCents / serviceUnits),
  };
}

export function isFoundingTrainerRankEligible(rank: number | null | undefined): boolean {
  if (rank == null || rank < 1) return false;
  return rank <= getFoundingTrainerSalesBonusMaxTrainers();
}

/** How many founding sales bonuses this trainer has already received. */
export async function countFoundingSalesBonusesGranted(
  trainerId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  return tx.trainerClientServiceTransaction.count({
    where: { trainerId, foundingSalesBonusGrantedAt: { not: null } },
  });
}

export async function resolveFoundingSalesBonusForPurchase(args: {
  trainerId: string;
  amountCents: number;
  totalChargedCents?: number | null;
  adminFeeCents?: number | null;
  completedAt?: Date;
  tx?: Prisma.TransactionClient;
}): Promise<FoundingSalesBonusPlan> {
  const completedAt = args.completedAt ?? new Date();
  if (!isFoundingTrainerSalesBonusEligibleDate(completedAt)) {
    return { bonusCents: 0, saleNumber: null };
  }

  const db = args.tx ?? prisma;
  const trainer = await db.trainer.findUnique({
    where: { id: args.trainerId },
    select: { foundingTrainerSignupRank: true },
  });
  if (!isFoundingTrainerRankEligible(trainer?.foundingTrainerSignupRank)) {
    return { bonusCents: 0, saleNumber: null };
  }

  const priorBonusSales = await countFoundingSalesBonusesGranted(args.trainerId, db);
  const maxSales = getFoundingTrainerSalesBonusMaxSales();
  if (priorBonusSales >= maxSales) {
    return { bonusCents: 0, saleNumber: null };
  }

  const bonusCents = computeFoundingSalesBonusCents({
    totalChargedCents: args.totalChargedCents,
    amountCents: args.amountCents,
    adminFeeCents: args.adminFeeCents,
  });
  if (bonusCents <= 0) {
    return { bonusCents: 0, saleNumber: null };
  }

  return { bonusCents, saleNumber: priorBonusSales + 1 };
}

export function foundingTrainerRankForSignup(trainerCountBeforeInsert: number): number | null {
  return isFoundingTrainerBySignupRank(trainerCountBeforeInsert) ? trainerCountBeforeInsert + 1 : null;
}

/** Alias used at trainer signup. */
export function foundingTrainerSignupRankForNewTrainer(trainerCountBeforeInsert: number): number | null {
  return foundingTrainerRankForSignup(trainerCountBeforeInsert);
}

export function formatFoundingSalesBonusUsd(bonusCents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Math.max(0, bonusCents) / 100,
  );
}

export async function notifyFoundingSalesBonusGranted(args: {
  trainerId: string;
  bonusCents: number;
  saleNumber: number;
}): Promise<void> {
  const maxSales = getFoundingTrainerSalesBonusMaxSales();
  await prisma.trainerNotification.create({
    data: {
      trainerId: args.trainerId,
      kind: "BILLING",
      title: "Founding coach sales bonus",
      body: `You earned ${formatFoundingSalesBonusUsd(args.bonusCents)} back on sale ${args.saleNumber} of ${maxSales} through Match Fit checkout (founding trainer perk).`,
      linkHref: "/trainer/dashboard",
    },
  });
}
