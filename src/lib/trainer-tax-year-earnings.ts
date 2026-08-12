import "server-only";

import { prisma } from "@/lib/prisma";

/** IRS 1099-NEC reporting threshold: report nonemployee compensation of $600 or more in a calendar year. */
export const IRS_1099_NEC_THRESHOLD_CENTS = 60_000;

/**
 * Ledger reasons that represent genuine earned income for tax purposes — excludes
 * WALLET_SPEND/PAYOUT_WITHDRAWAL (debits) and PAYOUT_REVERSED (a reversal of a failed
 * withdrawal, not new income, even though its delta is positive).
 */
const TAXABLE_EARNING_REASONS = ["SESSION_PAYOUT_CLEARED", "SERVICE_SALE_CLEARED"] as const;

function taxYearRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

/** Total earned-income cents credited to a trainer's ledger within a calendar year (UTC). */
export async function computeTrainerEarningsForTaxYear(trainerId: string, year: number): Promise<number> {
  const { start, end } = taxYearRange(year);
  const result = await prisma.trainerEarningsLedgerEntry.aggregate({
    where: {
      trainerId,
      reason: { in: [...TAXABLE_EARNING_REASONS] },
      createdAt: { gte: start, lt: end },
    },
    _sum: { deltaCents: true },
  });
  return result._sum.deltaCents ?? 0;
}

export type TrainerTaxYearEarningsRow = {
  trainerId: string;
  totalEarnedCents: number;
  overThreshold: boolean;
};

/** Every trainer with any earned income in the given tax year, most-earned first. */
export async function listTrainerEarningsForTaxYear(year: number): Promise<TrainerTaxYearEarningsRow[]> {
  const { start, end } = taxYearRange(year);
  const grouped = await prisma.trainerEarningsLedgerEntry.groupBy({
    by: ["trainerId"],
    where: {
      reason: { in: [...TAXABLE_EARNING_REASONS] },
      createdAt: { gte: start, lt: end },
    },
    _sum: { deltaCents: true },
  });
  return grouped
    .map((row) => ({
      trainerId: row.trainerId,
      totalEarnedCents: row._sum.deltaCents ?? 0,
      overThreshold: (row._sum.deltaCents ?? 0) >= IRS_1099_NEC_THRESHOLD_CENTS,
    }))
    .sort((a, b) => b.totalEarnedCents - a.totalEarnedCents);
}
