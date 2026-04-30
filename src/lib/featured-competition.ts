import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { easternDayStartUtcMs } from "@/lib/featured-eastern-calendar";
import { FEATURED_RULES_VERSION } from "@/lib/featured-rules-version";

export { FEATURED_RULES_VERSION };

/** Random draw slots (remaining carousel seats after paid bids). */
export const FEATURED_RAFFLE_WINNERS = 3;
/** Paid auction slots per region per display day. */
export const FEATURED_BID_WINNERS = 2;
/** Each raffle entrant receives this many tickets in the weighted hat. */
export const FEATURED_TICKETS_PER_ENTRANT = 5;
export const FEATURED_MIN_FIRST_BID_CENTS = 500; // $5.00 promotional floor

export type BidRow = { trainerId: string; amountCents: number; updatedAt: Date };

export function sortBidsDesc(bids: BidRow[]): BidRow[] {
  return [...bids].sort((a, b) => {
    if (b.amountCents !== a.amountCents) return b.amountCents - a.amountCents;
    return a.updatedAt.getTime() - b.updatedAt.getTime();
  });
}

function trainerInTopTwo(bids: BidRow[], hypo: BidRow): boolean {
  const merged = bids.filter((b) => b.trainerId !== hypo.trainerId);
  merged.push(hypo);
  const top = sortBidsDesc(merged).slice(0, 2);
  return top.some((b) => b.trainerId === hypo.trainerId);
}

/**
 * Smallest total bid (USD cents) for `trainerId` so they rank in the top two at `bidTime`
 * (ties favor earlier `updatedAt` / earlier commitment).
 */
export function minBidCentsToPlaceInTopTwo(bids: BidRow[], trainerId: string, bidTime: Date): number {
  const without = bids.filter((b) => b.trainerId !== trainerId);
  let lo = FEATURED_MIN_FIRST_BID_CENTS;
  let hi = 10_000_000; // $100,000 cap
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (trainerInTopTwo(without, { trainerId, amountCents: mid, updatedAt: bidTime })) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function weightedPickTrainerIds(entries: { trainerId: string; ticketWeight: number }[], count: number, exclude: Set<string>): string[] {
  const winners: string[] = [];
  const pool = () =>
    entries.filter((e) => !exclude.has(e.trainerId) && !winners.includes(e.trainerId));

  while (winners.length < count) {
    const p = pool();
    if (!p.length) break;
    const tickets: string[] = [];
    for (const e of p) {
      for (let i = 0; i < e.ticketWeight; i++) tickets.push(e.trainerId);
    }
    if (!tickets.length) break;
    const pick = tickets[randomInt(tickets.length)]!;
    winners.push(pick);
  }
  return winners;
}

export async function ensureFeaturedAllocationsResolved(regionZipPrefix: string, displayDayKey: string): Promise<void> {
  const cutoff = easternDayStartUtcMs(displayDayKey);
  if (Date.now() < cutoff) return;

  const existing = await prisma.featuredDailyAllocation.findFirst({
    where: { regionZipPrefix, displayDayKey },
  });
  if (existing) return;

  const bids = await prisma.featuredPlacementBid.findMany({
    where: { regionZipPrefix, displayDayKey },
    select: { trainerId: true, amountCents: true, updatedAt: true },
  });

  const sortedBids = sortBidsDesc(bids);
  const paidWinners = sortedBids.slice(0, FEATURED_BID_WINNERS);
  const paidSet = new Set(paidWinners.map((b) => b.trainerId));

  const entries = await prisma.featuredRaffleEntry.findMany({
    where: { regionZipPrefix, displayDayKey },
    select: { trainerId: true, ticketWeight: true },
  });

  const raffleTrainerIds = weightedPickTrainerIds(entries, FEATURED_RAFFLE_WINNERS, paidSet);

  const rows: { regionZipPrefix: string; displayDayKey: string; trainerId: string; source: string; sortOrder: number }[] = [];
  let order = 0;
  for (const b of paidWinners) {
    rows.push({
      regionZipPrefix,
      displayDayKey,
      trainerId: b.trainerId,
      source: "PAID_BID",
      sortOrder: order++,
    });
  }
  for (const tid of raffleTrainerIds) {
    rows.push({
      regionZipPrefix,
      displayDayKey,
      trainerId: tid,
      source: "RAFFLE",
      sortOrder: order++,
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const again = await tx.featuredDailyAllocation.findFirst({ where: { regionZipPrefix, displayDayKey } });
      if (again) return;
      for (const r of rows) {
        await tx.featuredDailyAllocation.create({ data: r });
      }
    });
  } catch {
    // concurrent resolver — ignore unique violations
  }
}
