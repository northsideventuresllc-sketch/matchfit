import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type {
  AdminFinanceClientSegment,
  AdminFinanceFpTierSegment,
  AdminFinanceRevenueBreakdown,
  AdminFinancesPanelSegments,
  AdminRevenueByCategory,
} from "@/lib/admin-portal-types";
import {
  adminMemberOverviewFreePlanClientWhere,
  adminMemberOverviewInactiveClientWhere,
  adminMemberOverviewVipPlanClientWhere,
} from "@/lib/admin-portal-list-filters";
import {
  FP_TIER_DISPLAY_NAMES,
  type FpAccountTier,
} from "@/lib/fp-account-tier-types";
import { launchClientCountWhere, launchTrainerCountWhere } from "@/lib/launch-account-counts";
import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";
import type { PlatformRevenueCategory } from "@/lib/platform-revenue-accounting";
import { mergeLiveRevenueWhere } from "@/lib/platform-revenue-filters";
import {
  countActiveFitProsForTiers,
  countPendingFitProsForTiers,
  countPremiumStudioForTiers,
} from "@/lib/admin-fitpro-pipeline-metrics";

const EMPTY_BY_CATEGORY = (): AdminRevenueByCategory => ({
  SERVICE_CHECKOUT: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
  CLIENT_PLATFORM_SUBSCRIPTION: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
  TRAINER_PREMIUM_SUBSCRIPTION: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
  ONE_TIME_PURCHASE: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
});

function emptyRevenueBreakdown(): AdminFinanceRevenueBreakdown {
  return {
    revenueCents: 0,
    grossProfitCents: 0,
    byCategory: EMPTY_BY_CATEGORY(),
    serviceSpendCents: 0,
    servicePlatformFeesCents: 0,
    serviceCheckoutCount: 0,
    oneTimePurchaseCents: 0,
    subscriptionRevenueCents: 0,
  };
}

export function emptyAdminFinanceClientSegment(): AdminFinanceClientSegment {
  return {
    clientCount: 0,
    lifetime: emptyRevenueBreakdown(),
    last30d: emptyRevenueBreakdown(),
  };
}

export function emptyAdminFinanceFpTierSegment(tier: FpAccountTier): AdminFinanceFpTierSegment {
  const emptyFp = () => ({
    ...emptyRevenueBreakdown(),
    registrationFeesCents: 0,
    tokenRevenueCents: 0,
    nudgePackRevenueCents: 0,
    monthlySubscriptionCents: 0,
  });
  return {
    tier,
    label: FP_TIER_DISPLAY_NAMES[tier],
    activeFitPros: 0,
    pendingFitPros: 0,
    liveFitPros: 0,
    monthlySubscriptionsActive: 0,
    premiumStudioEnabled: 0,
    lifetime: emptyFp(),
    last30d: emptyFp(),
  };
}

export function emptyAdminFinancesPanelSegments(): AdminFinancesPanelSegments {
  return {
    freePlanClients: emptyAdminFinanceClientSegment(),
    vipPlanClients: emptyAdminFinanceClientSegment(),
    inactiveClients: emptyAdminFinanceClientSegment(),
    matchFitPros: emptyAdminFinanceFpTierSegment("match_fit_pro"),
    matchFitPremiumPros: emptyAdminFinanceFpTierSegment("match_fit_premium_pro"),
    independentFitnessPros: emptyAdminFinanceFpTierSegment("independent_fitness_pro"),
    eliteFitnessPros: emptyAdminFinanceFpTierSegment("elite_fitness_pro"),
  };
}

function clientSegmentWhere(segmentWhere: Prisma.ClientWhereInput): Prisma.ClientWhereInput {
  return { AND: [segmentWhere, launchClientCountWhere()] };
}

function trainerTierWhere(tier: FpAccountTier): Prisma.TrainerWhereInput {
  return {
    AND: [launchTrainerCountWhere(), { profile: { is: { accountTier: tier } } }],
  };
}

function foldPlatformGrouped(
  grouped: {
    category: string;
    _sum: { revenueCents: number | null; grossProfitCents: number | null };
    _count: { _all: number };
  }[],
): AdminFinanceRevenueBreakdown {
  const byCategory = EMPTY_BY_CATEGORY();
  let revenueCents = 0;
  let grossProfitCents = 0;
  let oneTimePurchaseCents = 0;
  let subscriptionRevenueCents = 0;

  for (const row of grouped) {
    const cat = row.category as PlatformRevenueCategory;
    if (!(cat in byCategory)) continue;
    const rev = row._sum.revenueCents ?? 0;
    const profit = row._sum.grossProfitCents ?? 0;
    byCategory[cat] = { revenueCents: rev, grossProfitCents: profit, eventCount: row._count._all };
    revenueCents += rev;
    grossProfitCents += profit;
    if (cat === "ONE_TIME_PURCHASE") oneTimePurchaseCents += rev;
    if (cat === "CLIENT_PLATFORM_SUBSCRIPTION" || cat === "TRAINER_PREMIUM_SUBSCRIPTION") {
      subscriptionRevenueCents += rev;
    }
  }

  return {
    revenueCents,
    grossProfitCents,
    byCategory,
    serviceSpendCents: 0,
    servicePlatformFeesCents: 0,
    serviceCheckoutCount: 0,
    oneTimePurchaseCents,
    subscriptionRevenueCents,
  };
}

async function clientIdsForSegment(segmentWhere: Prisma.ClientWhereInput): Promise<string[]> {
  const rows = await prisma.client.findMany({
    where: clientSegmentWhere(segmentWhere),
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

async function trainerIdsForTier(tier: FpAccountTier): Promise<string[]> {
  const rows = await prisma.trainer.findMany({
    where: trainerTierWhere(tier),
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

function revenueEventClientFilter(clientIds: string[], since: Date | null) {
  if (clientIds.length === 0) return null;
  return mergeLiveRevenueWhere({
    clientId: { in: clientIds },
    ...(since ? { createdAt: { gte: since } } : {}),
  });
}

function revenueEventTrainerFilter(trainerIds: string[], since: Date | null, extra?: Prisma.PlatformRevenueEventWhereInput) {
  if (trainerIds.length === 0) return null;
  return mergeLiveRevenueWhere({
    trainerId: { in: trainerIds },
    ...(since ? { createdAt: { gte: since } } : {}),
    ...extra,
  });
}

async function loadClientSegmentRevenue(
  segmentWhere: Prisma.ClientWhereInput,
  since: Date | null,
): Promise<AdminFinanceRevenueBreakdown> {
  const serviceTimeFilter = since ? { completedAt: { gte: since } } : {};

  try {
    const clientIds = await clientIdsForSegment(segmentWhere);
    const eventWhere = revenueEventClientFilter(clientIds, since);

    const [grouped, serviceAgg] = await Promise.all([
      eventWhere
        ? prisma.platformRevenueEvent.groupBy({
            by: ["category"],
            where: eventWhere,
            _sum: { revenueCents: true, grossProfitCents: true },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      clientIds.length === 0
        ? Promise.resolve({ _sum: { totalChargedCents: 0, adminFeeCents: 0, amountCents: 0 }, _count: { _all: 0 } })
        : prisma.trainerClientServiceTransaction.aggregate({
            where: {
              clientId: { in: clientIds },
              trainer: launchTrainerCountWhere(),
              ...serviceTimeFilter,
            },
            _sum: { totalChargedCents: true, adminFeeCents: true, amountCents: true },
            _count: { _all: true },
          }),
    ]);

    const breakdown = foldPlatformGrouped(grouped);
    const serviceSpendCents =
      serviceAgg._sum.totalChargedCents ??
      serviceAgg._sum.amountCents ??
      breakdown.byCategory.SERVICE_CHECKOUT?.revenueCents ??
      0;
    breakdown.serviceSpendCents = serviceSpendCents;
    breakdown.servicePlatformFeesCents = serviceAgg._sum.adminFeeCents ?? 0;
    breakdown.serviceCheckoutCount = serviceAgg._count._all;
    return breakdown;
  } catch (e) {
    if (isPrismaMissingTableError(e, "platform_revenue_events")) return emptyRevenueBreakdown();
    throw e;
  }
}

async function loadClientSegment(
  segmentWhere: Prisma.ClientWhereInput,
  now: Date,
): Promise<AdminFinanceClientSegment> {
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const clientWhere = clientSegmentWhere(segmentWhere);

  const [clientCount, lifetime, last30d, clientsWithCard] = await Promise.all([
    prisma.client.count({ where: clientWhere }).catch(() => 0),
    loadClientSegmentRevenue(segmentWhere, null),
    loadClientSegmentRevenue(segmentWhere, since30d),
    prisma.client
      .count({
        where: {
          AND: [clientWhere, { stripeCustomerId: { not: null } }],
        },
      })
      .catch(() => 0),
  ]);

  return { clientCount, lifetime, last30d, clientsWithCard };
}

async function sumOneTimePurposeRevenue(args: {
  trainerIds: string[];
  purposeFragment: string;
  since: Date | null;
}): Promise<number> {
  const eventWhere = revenueEventTrainerFilter(args.trainerIds, args.since, {
    category: "ONE_TIME_PURCHASE",
    metaJson: { contains: args.purposeFragment },
  });
  if (!eventWhere) return 0;
  try {
    const row = await prisma.platformRevenueEvent.aggregate({
      where: eventWhere,
      _sum: { revenueCents: true },
    });
    return row._sum.revenueCents ?? 0;
  } catch {
    return 0;
  }
}

async function countMonthlySubscriptionsForTier(tier: FpAccountTier, now: Date): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM trainers t
      INNER JOIN trainer_profiles p ON p."trainerId" = t.id
      WHERE t."deidentifiedAt" IS NULL
        AND COALESCE(t."internalQaSyntheticPersona", false) = false
        AND p."accountTier" = ${tier}
        AND p."billingCycleEnd" IS NOT NULL
        AND p."billingCycleEnd" > ${now}
    `;
    return Number(rows[0]?.n ?? BigInt(0));
  } catch {
    return 0;
  }
}

async function countLiveFitProsForTier(tier: FpAccountTier): Promise<number> {
  return prisma.trainer
    .count({
      where: {
        ...trainerTierWhere(tier),
        profile: { is: { dashboardActivatedAt: { not: null } } },
      },
    })
    .catch(() => 0);
}

async function loadFpTierSegment(tier: FpAccountTier, now: Date): Promise<AdminFinanceFpTierSegment> {
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const tiers = [tier];

  async function loadFpRevenue(trainerIds: string[], since: Date | null) {
    const serviceTimeFilter = since ? { completedAt: { gte: since } } : {};
    const eventWhere = revenueEventTrainerFilter(trainerIds, since);

    const [grouped, serviceAgg, registrationFeesCents, tokenRevenueCents, nudgePackRevenueCents] =
      await Promise.all([
        eventWhere
          ? prisma.platformRevenueEvent
              .groupBy({
                by: ["category"],
                where: eventWhere,
                _sum: { revenueCents: true, grossProfitCents: true },
                _count: { _all: true },
              })
              .catch(() => [])
          : Promise.resolve([]),
        trainerIds.length === 0
          ? Promise.resolve({ _sum: { adminFeeCents: 0 } })
          : prisma.trainerClientServiceTransaction
              .aggregate({
                where: {
                  trainerId: { in: trainerIds },
                  client: launchClientCountWhere(),
                  ...serviceTimeFilter,
                },
                _sum: { adminFeeCents: true },
              })
              .catch(() => ({ _sum: { adminFeeCents: 0 } })),
        sumOneTimePurposeRevenue({
          trainerIds,
          purposeFragment: "trainer_registration_fee",
          since,
        }),
        sumOneTimePurposeRevenue({
          trainerIds,
          purposeFragment: "trainer_promo_tokens",
          since,
        }),
        sumOneTimePurposeRevenue({
          trainerIds,
          purposeFragment: "fp_nudge_pack",
          since,
        }),
      ]);

    const breakdown = foldPlatformGrouped(grouped);
    breakdown.servicePlatformFeesCents = serviceAgg._sum.adminFeeCents ?? 0;
    const monthlySubscriptionCents =
      (breakdown.byCategory.TRAINER_PREMIUM_SUBSCRIPTION?.revenueCents ?? 0) +
      (breakdown.byCategory.CLIENT_PLATFORM_SUBSCRIPTION?.revenueCents ?? 0);

    return {
      ...breakdown,
      registrationFeesCents,
      tokenRevenueCents,
      nudgePackRevenueCents,
      monthlySubscriptionCents,
    };
  }

  const trainerIds = await trainerIdsForTier(tier);

  const [
    activeFitPros,
    pendingFitPros,
    liveFitPros,
    monthlySubscriptionsActive,
    premiumStudioEnabled,
    lifetime,
    last30d,
  ] = await Promise.all([
    countActiveFitProsForTiers(tiers),
    countPendingFitProsForTiers(tiers),
    countLiveFitProsForTier(tier),
    countMonthlySubscriptionsForTier(tier, now),
    countPremiumStudioForTiers(tiers),
    loadFpRevenue(trainerIds, null),
    loadFpRevenue(trainerIds, since30d),
  ]);

  return {
    tier,
    label: FP_TIER_DISPLAY_NAMES[tier],
    activeFitPros,
    pendingFitPros,
    liveFitPros,
    monthlySubscriptionsActive,
    premiumStudioEnabled,
    lifetime,
    last30d,
  };
}

export async function loadAdminFinancesPanelSegments(now = new Date()): Promise<AdminFinancesPanelSegments> {
  try {
    const [freePlanClients, vipPlanClients, inactiveClients, matchFitPros, matchFitPremiumPros, independentFitnessPros, eliteFitnessPros] =
      await Promise.all([
        loadClientSegment(adminMemberOverviewFreePlanClientWhere(now), now),
        loadClientSegment(adminMemberOverviewVipPlanClientWhere(now), now),
        loadClientSegment(adminMemberOverviewInactiveClientWhere(now), now),
        loadFpTierSegment("match_fit_pro", now),
        loadFpTierSegment("match_fit_premium_pro", now),
        loadFpTierSegment("independent_fitness_pro", now),
        loadFpTierSegment("elite_fitness_pro", now),
      ]);

    return {
      freePlanClients,
      vipPlanClients,
      inactiveClients,
      matchFitPros,
      matchFitPremiumPros,
      independentFitnessPros,
      eliteFitnessPros,
    };
  } catch (e) {
    if (isPrismaMissingTableError(e, "platform_revenue_events")) {
      return emptyAdminFinancesPanelSegments();
    }
    throw e;
  }
}
