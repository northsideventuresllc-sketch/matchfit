import { prisma } from "@/lib/prisma";

export type BookingSticker = "CONFIRMED" | "NOT_CONFIRMED" | "CANCELLED";

export type ManagementUpcomingBooking = {
  id: string;
  scheduledStartAt: string;
  scheduledEndAt: string | null;
  status: string;
  sticker: BookingSticker;
  categoryLabel: string;
  sessionDelivery: string | null;
  inviteNote: string | null;
  videoConferenceJoinUrl: string | null;
  trainerEarnCents: number;
  sourceServiceTransactionId: string | null;
  purchaseSnapshot: string | null;
  sessionsLeftOnPurchase: number | null;
  addonUnitsLeftOnPurchase: number | null;
  bookingUnlimitedOnPurchase: boolean;
  fulfillmentStatus: string;
  hasTrainerPunchIn: boolean;
};

export type TrainerNextPunchBanner = {
  bookingId: string;
  clientUsername: string;
  clientDisplayName: string;
  scheduledStartAt: string;
  scheduledEndAt: string | null;
};

export type PastClientRosterItem = {
  clientId: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
};

export type PayoutPipelineRow = {
  bookingId: string;
  clientUsername: string;
  clientDisplayName: string;
  scheduledStartAt: string;
  fulfillmentStatus: string;
  payoutBufferEndsAt: string | null;
  sessionClosedAt: string | null;
  coachPortionCents: number;
  addonPortionCents: number;
  headline: string;
};

export type TrainerRankingScope = "GLOBAL" | "ZIP" | "STATE";

export type TrainerRankingsPayload = {
  scope: TrainerRankingScope;
  cohortLabel: string | null;
  /** Session volume vs trainers in the selected cohort (same metric as global count, different peer set). */
  cohortSessionsPercentile: number | null;
  sessionsCompleted: number;
  sessionsCompletedPercentile: number;
  fiveStarReviews: number;
  fiveStarPercentile: number;
  fitHubPosts: number;
  fitHubPostsPercentile: number;
};

function bookingSticker(status: string): BookingSticker {
  if (status === "CANCELLED" || status === "AUTO_COMPLETED") return "CANCELLED";
  if (status === "CLIENT_CONFIRMED") return "CONFIRMED";
  return "NOT_CONFIRMED";
}

const CANCELLED_BOOKING = new Set<string>([
  "CANCELLED",
  "AUTO_COMPLETED",
  "CANCELLED_FOREGONE",
  "CANCELLED_RESCHED_DECLINED_BY_CLIENT",
  "CANCELLED_RESCHED_DECLINED_BY_TRAINER",
  "CANCELLED_TRAINER_SUSPENDED",
]);

function displayClientName(row: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
  username: string;
}): string {
  return (
    row.preferredName?.trim() ||
    [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
    `@${row.username}`
  );
}

function modeOfStrings(values: string[]): string | null {
  if (!values.length) return null;
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

export async function loadUpcomingBookingsByClientForTrainer(
  trainerId: string,
  clientIds: string[],
): Promise<Map<string, ManagementUpcomingBooking[]>> {
  const map = new Map<string, ManagementUpcomingBooking[]>();
  for (const id of clientIds) map.set(id, []);
  if (!clientIds.length) return map;

  const since = new Date(Date.now() - 36 * 60 * 60 * 1000);
  const until = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

  const rows = await prisma.bookedTrainingSession.findMany({
    where: {
      trainerId,
      clientId: { in: clientIds },
      scheduledStartAt: { gte: since, lte: until },
    },
    orderBy: { scheduledStartAt: "asc" },
    select: {
      id: true,
      clientId: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      status: true,
      sessionDelivery: true,
      inviteNote: true,
      videoConferenceJoinUrl: true,
      allocatedCoachServiceCents: true,
      allocatedNetAddonCents: true,
      fulfillmentStatus: true,
      sourceServiceTransactionId: true,
      sourceServiceTransaction: {
        select: {
          purchaseLabelSnapshot: true,
          sessionCreditsGranted: true,
          bookingUnlimitedPurchase: true,
          ledgerTotalAddonUnits: true,
        },
      },
      punchIns: { select: { id: true }, take: 1 },
    },
  });

  const txIds = [...new Set(rows.map((r) => r.sourceServiceTransactionId).filter(Boolean))] as string[];
  const usageByTx = new Map<string, number>();
  const addonUsedByTx = new Map<string, number>();
  if (txIds.length) {
    const usageGroups = await prisma.bookedTrainingSession.groupBy({
      by: ["sourceServiceTransactionId"],
      where: {
        sourceServiceTransactionId: { in: txIds },
        status: { notIn: ["INVITED", "CANCELLED"] },
      },
      _count: { _all: true },
    });
    for (const g of usageGroups) {
      if (g.sourceServiceTransactionId) usageByTx.set(g.sourceServiceTransactionId, g._count._all);
    }
    const addonGroups = await prisma.bookedTrainingSession.groupBy({
      by: ["sourceServiceTransactionId"],
      where: {
        sourceServiceTransactionId: { in: txIds },
        allocatedNetAddonCents: { gt: 0 },
        status: { not: "INVITED" },
      },
      _count: { _all: true },
    });
    for (const g of addonGroups) {
      if (g.sourceServiceTransactionId) addonUsedByTx.set(g.sourceServiceTransactionId, g._count._all);
    }
  }

  for (const r of rows) {
    const tx = r.sourceServiceTransaction;
    const txId = r.sourceServiceTransactionId;
    let sessionsLeft: number | null = null;
    let addonLeft: number | null = null;
    let unlimited = false;
    if (tx && txId) {
      unlimited = tx.bookingUnlimitedPurchase;
      if (!unlimited && (tx.sessionCreditsGranted ?? 0) > 0) {
        const used = usageByTx.get(txId) ?? 0;
        sessionsLeft = Math.max(0, (tx.sessionCreditsGranted ?? 0) - used);
      }
      const totalAddon = Math.max(0, tx.ledgerTotalAddonUnits ?? 0);
      if (totalAddon > 0) {
        const usedA = Math.min(totalAddon, addonUsedByTx.get(txId) ?? 0);
        addonLeft = Math.max(0, totalAddon - usedA);
      }
    }

    const sticker = CANCELLED_BOOKING.has(r.status) ? "CANCELLED" : bookingSticker(r.status);
    const category =
      tx?.purchaseLabelSnapshot?.trim() ||
      (r.allocatedNetAddonCents > 0 && !tx?.purchaseLabelSnapshot ? "Add-on session" : null) ||
      "Training session";

    const item: ManagementUpcomingBooking = {
      id: r.id,
      scheduledStartAt: r.scheduledStartAt.toISOString(),
      scheduledEndAt: r.scheduledEndAt?.toISOString() ?? null,
      status: r.status,
      sticker,
      categoryLabel: category,
      sessionDelivery: r.sessionDelivery,
      inviteNote: r.inviteNote,
      videoConferenceJoinUrl: r.videoConferenceJoinUrl,
      trainerEarnCents: Math.max(0, r.allocatedCoachServiceCents) + Math.max(0, r.allocatedNetAddonCents),
      sourceServiceTransactionId: txId,
      purchaseSnapshot: tx?.purchaseLabelSnapshot ?? null,
      sessionsLeftOnPurchase: unlimited ? null : sessionsLeft,
      addonUnitsLeftOnPurchase: addonLeft,
      bookingUnlimitedOnPurchase: unlimited,
      fulfillmentStatus: r.fulfillmentStatus,
      hasTrainerPunchIn: (r.punchIns?.length ?? 0) > 0,
    };
    const list = map.get(r.clientId);
    if (list) list.push(item);
  }
  return map;
}

export async function loadTrainerNextPunchBanner(trainerId: string): Promise<TrainerNextPunchBanner | null> {
  const row = await prisma.bookedTrainingSession.findFirst({
    where: {
      trainerId,
      status: "CLIENT_CONFIRMED",
      punchIns: { none: {} },
      scheduledStartAt: {
        gte: new Date(Date.now() - 2 * 60 * 60 * 1000),
        lte: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { scheduledStartAt: "asc" },
    select: {
      id: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      client: {
        select: { username: true, preferredName: true, firstName: true, lastName: true },
      },
    },
  });
  if (!row) return null;
  return {
    bookingId: row.id,
    clientUsername: row.client.username,
    clientDisplayName: displayClientName(row.client),
    scheduledStartAt: row.scheduledStartAt.toISOString(),
    scheduledEndAt: row.scheduledEndAt?.toISOString() ?? null,
  };
}

export async function loadPastClientsRoster(trainerId: string): Promise<PastClientRosterItem[]> {
  const fromBookings = await prisma.bookedTrainingSession.findMany({
    where: { trainerId },
    distinct: ["clientId"],
    select: {
      clientId: true,
      client: {
        select: {
          username: true,
          preferredName: true,
          firstName: true,
          lastName: true,
          profileImageUrl: true,
        },
      },
    },
  });
  const fromChats = await prisma.trainerClientConversation.findMany({
    where: { trainerId, officialChatStartedAt: { not: null } },
    select: {
      clientId: true,
      client: {
        select: {
          username: true,
          preferredName: true,
          firstName: true,
          lastName: true,
          profileImageUrl: true,
        },
      },
    },
  });
  const merged = new Map<string, PastClientRosterItem>();
  for (const r of [...fromBookings, ...fromChats]) {
    merged.set(r.clientId, {
      clientId: r.clientId,
      username: r.client.username,
      displayName: displayClientName(r.client),
      profileImageUrl: r.client.profileImageUrl,
    });
  }
  return [...merged.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function loadClientHistoryBundle(trainerId: string, clientId: string) {
  const [transactions, completedSessions] = await Promise.all([
    prisma.trainerClientServiceTransaction.findMany({
      where: { trainerId, clientId },
      orderBy: { completedAt: "desc" },
      take: 40,
      select: {
        id: true,
        completedAt: true,
        amountCents: true,
        purchaseLabelSnapshot: true,
        sessionCreditsGranted: true,
        bookingUnlimitedPurchase: true,
        ledgerNetAfterFeesCents: true,
      },
    }),
    prisma.bookedTrainingSession.findMany({
      where: {
        trainerId,
        clientId,
        trainerGateBCompletedAt: { not: null },
      },
      orderBy: { scheduledStartAt: "desc" },
      take: 40,
      select: {
        id: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        fulfillmentStatus: true,
        allocatedCoachServiceCents: true,
        allocatedNetAddonCents: true,
      },
    }),
  ]);
  return {
    transactions: transactions.map((t) => ({
      id: t.id,
      completedAt: t.completedAt.toISOString(),
      amountCents: t.amountCents,
      label: t.purchaseLabelSnapshot ?? "Service purchase",
      sessionCreditsGranted: t.sessionCreditsGranted,
      bookingUnlimitedPurchase: t.bookingUnlimitedPurchase,
      ledgerNetAfterFeesCents: t.ledgerNetAfterFeesCents,
    })),
    completedSessions: completedSessions.map((s) => ({
      id: s.id,
      scheduledStartAt: s.scheduledStartAt.toISOString(),
      scheduledEndAt: s.scheduledEndAt?.toISOString() ?? null,
      fulfillmentStatus: s.fulfillmentStatus,
      trainerEarnCents: Math.max(0, s.allocatedCoachServiceCents) + Math.max(0, s.allocatedNetAddonCents),
    })),
  };
}

const PAYOUT_TRACK_STATUSES = new Set([
  "WAITING_TRAINER_GATE_B",
  "GATES_IN_PAYOUT_BUFFER",
  "SESSION_PAYMENT_ROUTE_CLEARED",
]);

const MS_72H = 72 * 60 * 60 * 1000;

export async function loadTrainerPayoutPipelineRows(trainerId: string, now = new Date()): Promise<PayoutPipelineRow[]> {
  const rows = await prisma.bookedTrainingSession.findMany({
    where: {
      trainerId,
      status: "CLIENT_CONFIRMED",
      gateASatisfiedAt: { not: null },
      fulfillmentStatus: { in: [...PAYOUT_TRACK_STATUSES] },
    },
    orderBy: { scheduledStartAt: "desc" },
    take: 40,
    select: {
      id: true,
      scheduledStartAt: true,
      fulfillmentStatus: true,
      payoutBufferEndsAt: true,
      sessionClosedAt: true,
      allocatedCoachServiceCents: true,
      allocatedNetAddonCents: true,
      client: {
        select: { username: true, preferredName: true, firstName: true, lastName: true },
      },
    },
  });

  const out: PayoutPipelineRow[] = [];
  for (const r of rows) {
    if (r.fulfillmentStatus === "SESSION_PAYMENT_ROUTE_CLEARED" && r.sessionClosedAt) {
      if (now.getTime() > r.sessionClosedAt.getTime() + MS_72H) continue;
    }
    let headline = "Client check-in complete — payout path updating.";
    if (r.fulfillmentStatus === "WAITING_TRAINER_GATE_B") {
      headline = "Client marked the session — finish Gate B to start the payout buffer.";
    } else if (r.fulfillmentStatus === "GATES_IN_PAYOUT_BUFFER") {
      headline = "Payout dispute buffer running — funds release after the buffer unless frozen.";
    } else if (r.fulfillmentStatus === "SESSION_PAYMENT_ROUTE_CLEARED") {
      headline =
        "Ledger route cleared — deposits typically follow your connected account schedule; this row hides 72 hours after clearance for a tidy inbox.";
    }
    out.push({
      bookingId: r.id,
      clientUsername: r.client.username,
      clientDisplayName: displayClientName(r.client),
      scheduledStartAt: r.scheduledStartAt.toISOString(),
      fulfillmentStatus: r.fulfillmentStatus,
      payoutBufferEndsAt: r.payoutBufferEndsAt?.toISOString() ?? null,
      sessionClosedAt: r.sessionClosedAt?.toISOString() ?? null,
      coachPortionCents: Math.max(0, r.allocatedCoachServiceCents),
      addonPortionCents: Math.max(0, r.allocatedNetAddonCents),
      headline,
    });
  }
  return out;
}

export async function loadTrainerTransactionYears(trainerId: string): Promise<number[]> {
  const rows = await prisma.trainerClientServiceTransaction.findMany({
    where: { trainerId },
    select: { completedAt: true },
    orderBy: { completedAt: "desc" },
    take: 500,
  });
  const years = new Set<number>();
  for (const r of rows) years.add(r.completedAt.getUTCFullYear());
  return [...years].sort((a, b) => b - a);
}

export async function loadTrainerTransactionsForYear(trainerId: string, year: number) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return prisma.trainerClientServiceTransaction.findMany({
    where: { trainerId, completedAt: { gte: start, lt: end } },
    orderBy: { completedAt: "desc" },
    select: {
      id: true,
      completedAt: true,
      amountCents: true,
      purchaseLabelSnapshot: true,
      ledgerNetAfterFeesCents: true,
      totalChargedCents: true,
    },
  });
}

export async function loadTrainerPremiumFitHubFlag(trainerId: string): Promise<boolean> {
  const p = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { premiumStudioEnabledAt: true },
  });
  return p?.premiumStudioEnabledAt != null;
}

function percentileAtOrBelow(my: number, distribution: number[]): number {
  if (distribution.length <= 1) return 100;
  const below = distribution.filter((v) => v < my).length;
  return Math.min(100, Math.round((100 * below) / Math.max(1, distribution.length - 1)));
}

async function cohortSessionPercentileForZipPrefix(
  trainerId: string,
  mySessions: number,
  prefixLen: 2 | 3,
): Promise<{ label: string | null; percentile: number | null }> {
  const prefixes = await prisma.bookedTrainingSession.findMany({
    where: { trainerId, trainerGateBCompletedAt: { not: null } },
    select: { client: { select: { zipCode: true } } },
    take: 400,
  });
  const digits = prefixes
    .map((p) => p.client.zipCode?.replace(/\D/g, ""))
    .filter((z): z is string => !!z && z.length >= prefixLen);
  const prefList = prefixLen === 3 ? digits.map((z) => z.slice(0, 3)) : digits.map((z) => z.slice(0, 2));
  const dominant = modeOfStrings(prefList.filter((z) => z.length === prefixLen));
  if (!dominant) return { label: null, percentile: null };

  const cohort =
    prefixLen === 3
      ? await prisma.$queryRaw<Array<{ trainerId: string; c: bigint }>>`
          SELECT b.trainerId as trainerId, COUNT(*) as c
          FROM booked_training_sessions b
          INNER JOIN clients c ON c.id = b.clientId
          WHERE b.trainerGateBCompletedAt IS NOT NULL
          AND length(trim(replace(c.zipCode, '-', ''))) >= 3
          AND substr(trim(replace(replace(c.zipCode, '-', ''), ' ', '')), 1, 3) = ${dominant}
          GROUP BY b.trainerId
        `
      : await prisma.$queryRaw<Array<{ trainerId: string; c: bigint }>>`
          SELECT b.trainerId as trainerId, COUNT(*) as c
          FROM booked_training_sessions b
          INNER JOIN clients c ON c.id = b.clientId
          WHERE b.trainerGateBCompletedAt IS NOT NULL
          AND length(trim(replace(c.zipCode, '-', ''))) >= 2
          AND substr(trim(replace(replace(c.zipCode, '-', ''), ' ', '')), 1, 2) = ${dominant}
          GROUP BY b.trainerId
        `;
  if (!cohort.length) return { label: null, percentile: null };
  const cohortCounts = cohort.map((row) => Number(row.c));
  const mineCohort = Number(cohort.find((r) => r.trainerId === trainerId)?.c ?? 0);
  return {
    label:
      prefixLen === 3
        ? `ZIP — client ZIP starts with ${dominant} (from your completed sessions)`
        : `State region — client ZIP starts with ${dominant} (first 2 digits; proxy when full state is unavailable)`,
    percentile: percentileAtOrBelow(mineCohort, cohortCounts),
  };
}

export async function loadTrainerRankingsPremiumScoped(
  trainerId: string,
  scope: TrainerRankingScope,
): Promise<TrainerRankingsPayload | null> {
  const premium = await loadTrainerPremiumFitHubFlag(trainerId);
  if (!premium) return null;

  const [sessionGroups, fiveGroups, postGroups, myFive, myPosts] = await Promise.all([
    prisma.bookedTrainingSession.groupBy({
      by: ["trainerId"],
      where: { trainerGateBCompletedAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.clientTrainerReview.groupBy({
      by: ["trainerId"],
      where: { stars: 5, removedByClientAt: null },
      _count: { _all: true },
    }),
    prisma.trainerFitHubPost.groupBy({
      by: ["trainerId"],
      _count: { _all: true },
    }),
    prisma.clientTrainerReview.count({ where: { trainerId, stars: 5, removedByClientAt: null } }),
    prisma.trainerFitHubPost.count({ where: { trainerId } }),
  ]);

  const sessionDist = sessionGroups.map((g) => g._count._all);
  const mySessions = sessionGroups.find((g) => g.trainerId === trainerId)?._count._all ?? 0;

  const fiveDist = fiveGroups.map((g) => g._count._all);
  const postDist = postGroups.map((g) => g._count._all);

  let cohortLabel: string | null = null;
  let cohortSessionsPercentile: number | null = null;
  if (scope === "ZIP") {
    const z = await cohortSessionPercentileForZipPrefix(trainerId, mySessions, 3);
    cohortLabel = z.label;
    cohortSessionsPercentile = z.percentile;
  } else if (scope === "STATE") {
    const s = await cohortSessionPercentileForZipPrefix(trainerId, mySessions, 2);
    cohortLabel = s.label;
    cohortSessionsPercentile = s.percentile;
  } else {
    cohortLabel = "All Match Fit trainers";
    cohortSessionsPercentile = percentileAtOrBelow(mySessions, sessionDist.length ? sessionDist : [0]);
  }

  return {
    scope,
    cohortLabel,
    cohortSessionsPercentile,
    sessionsCompleted: mySessions,
    sessionsCompletedPercentile: percentileAtOrBelow(mySessions, sessionDist.length ? sessionDist : [0]),
    fiveStarReviews: myFive,
    fiveStarPercentile: percentileAtOrBelow(myFive, fiveDist.length ? fiveDist : [0]),
    fitHubPosts: myPosts,
    fitHubPostsPercentile: percentileAtOrBelow(myPosts, postDist.length ? postDist : [0]),
  };
}

/** @deprecated use loadTrainerRankingsPremiumScoped */
export async function loadTrainerRankingsPremium(trainerId: string): Promise<TrainerRankingsPayload | null> {
  return loadTrainerRankingsPremiumScoped(trainerId, "ZIP");
}

export async function loadTrainerFinanceStats(
  trainerId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<{ grossBilledCents: number; netAfterFeesCents: number; mileageMiles: number; mileageDeductionCents: number }> {
  const txs = await prisma.trainerClientServiceTransaction.findMany({
    where: { trainerId, completedAt: { gte: rangeStart, lt: rangeEnd } },
    select: { amountCents: true, ledgerNetAfterFeesCents: true },
  });
  let grossBilledCents = 0;
  let netAfterFeesCents = 0;
  for (const t of txs) {
    grossBilledCents += Math.max(0, t.amountCents);
    netAfterFeesCents += Math.max(0, t.ledgerNetAfterFeesCents ?? t.amountCents);
  }
  const milesRows = await prisma.trainerBusinessMileageEntry.findMany({
    where: { trainerId, occurredAt: { gte: rangeStart, lt: rangeEnd } },
    select: { miles: true },
  });
  const mileageMiles = milesRows.reduce((s, r) => s + Math.max(0, r.miles), 0);
  /** IRS optional mileage rate placeholder (USD per mile) — UI shows disclaimer. */
  const IRS_BUSINESS_MILEAGE_USD_PER_MILE = 0.7;
  const mileageDeductionCents = Math.round(mileageMiles * IRS_BUSINESS_MILEAGE_USD_PER_MILE * 100);
  return { grossBilledCents, netAfterFeesCents, mileageMiles, mileageDeductionCents };
}

export async function loadTrainerProfileCompliance(trainerId: string) {
  const p = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { consecutiveMissedSessionPunches: true },
  });
  return { consecutiveMissedSessionPunches: p?.consecutiveMissedSessionPunches ?? 0 };
}

export async function loadTrainerClientManagementPageExtras(trainerId: string) {
  const [nextPunch, payoutPipeline, transactionYears, compliance, premiumFitHub, pastClients] = await Promise.all([
    loadTrainerNextPunchBanner(trainerId),
    loadTrainerPayoutPipelineRows(trainerId),
    loadTrainerTransactionYears(trainerId),
    loadTrainerProfileCompliance(trainerId),
    loadTrainerPremiumFitHubFlag(trainerId),
    loadPastClientsRoster(trainerId),
  ]);
  return {
    nextPunch,
    payoutPipeline,
    transactionYears,
    consecutiveMissedSessionPunches: compliance.consecutiveMissedSessionPunches,
    premiumFitHub,
    pastClients,
  };
}

export async function loadTrainerExpenseSummaryForYear(trainerId: string, year: number) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const rows = await prisma.trainerBusinessExpense.findMany({
    where: { trainerId, spentAt: { gte: start, lt: end } },
    orderBy: { spentAt: "desc" },
  });
  const byCat = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    total += Math.max(0, r.amountCents);
    byCat.set(r.category, (byCat.get(r.category) ?? 0) + Math.max(0, r.amountCents));
  }
  return { rows, byCategoryCents: Object.fromEntries(byCat), totalCents: total };
}
