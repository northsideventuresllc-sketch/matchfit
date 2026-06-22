import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type {
  AdminAlertGroup,
  AdminAlertItem,
  AdminAlertSeverity,
  AdminAlertsPanel,
  AdminClientPipelinePanel,
  AdminFinanceBestSeller,
  AdminFinanceRecentTransaction,
  AdminFinanceWindowKey,
  AdminFinanceWindowSnapshot,
  AdminFinancesPanel,
  AdminLoginRecencyBuckets,
  AdminPlatformFunctionStat,
  AdminPlatformSummaryPanel,
  AdminPremiumTrainerActivityPanel,
  AdminRevenueByCategory,
  AdminSiteActivityPanel,
  AdminTrainerPipelineEntry,
  AdminTrainerPipelinePanel,
  AdminTrainerPipelineStage,
  AdminTrafficFunnelPanel,
} from "@/lib/admin-portal-types";
import { getAdminEmailStatsPanel } from "@/lib/transactional-email-delivery-log";
import {
  filterOwnerTestIdentities,
  ownerTestExcludedPendingRegistrationWhere,
  ownerTestExcludedSignupProgressWhere,
} from "@/lib/owner-test-account-exclusion";
import {
  listFilledSignupFields,
  parseSignupFieldsJson,
  signupFieldsForRole,
} from "@/lib/signup-form-progress";
import { getHomeUserCounts } from "@/lib/home-user-counts";
import { isMissingClientPlatformTrialColumnError } from "@/lib/ensure-client-platform-trial-schema";
import { isMissingTrainerRegisterSchemaError } from "@/lib/ensure-trainer-register-schema";
import { isPrismaMissingColumnError, isPrismaMissingTableError } from "@/lib/prisma-missing-column";
import { prisma } from "@/lib/prisma";
import {
  computeMarketCompetitivenessProxy,
  computePlatformSuccessRating,
  daysSinceLaunch,
} from "@/lib/platform-success-rating";
import { computePlatformValuation } from "@/lib/platform-valuation";
import { computePlatformGrowthProjection } from "@/lib/platform-growth-projection";
import { computePlatformPotentialRating } from "@/lib/platform-potential-rating";
import type { PlatformRevenueCategory } from "@/lib/platform-revenue-accounting";
import { LIVE_PLATFORM_REVENUE_WHERE, mergeLiveRevenueWhere } from "@/lib/platform-revenue-filters";
import {
  activePendingClientRegistrationWhere,
  countLaunchPlatformSubscribers,
  countLaunchPremiumTrainers,
  getActivePendingClientRegistrationStats,
  launchClientBillingGraceWhere,
  launchClientCountWhere,
  launchClientFreeTrialCountWhere,
  launchClientPlatformPaymentGraceWhere,
  launchClientPlatformTrialCountWhere,
  launchClientStripeTrialCountWhere,
  launchClientWithCardWhere,
  launchTrainerBeforeRegistrationPaymentWhere,
  launchTrainerBeforeTermsWhere,
  launchTrainerCountWhere,
  launchTrainerIncompleteSignupWhere,
} from "@/lib/launch-account-counts";
import {
  adminPendingTrainerWhere,
  buildAdminPortalTrainerSqlFilter,
  buildLaunchMetricsClientSqlFilter,
  buildLaunchMetricsTrainerSqlFilter,
} from "@/lib/admin-portal-list-filters";
import { parseTopOffering } from "@/lib/admin-portal-parsers";
import { homepageDisplayDayKey } from "@/lib/featured-eastern-calendar";
import { repairStaleTrainerPendingRecords } from "@/lib/trainer-pending-onboarding";
import { buildTrainerPendingQualifications } from "@/lib/trainer-membership-status";

const CLIENT_SIGNUP_PATHS = ["/client/sign-up", "/client/sign-up/complete"];
const TRAINER_SIGNUP_PATHS = ["/trainer/signup", "/trainer/sign-up", "/trainer/signup/complete"];

const FINANCE_WINDOW_MS: Record<AdminFinanceWindowKey, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
  "5y": 5 * 365 * 24 * 60 * 60 * 1000,
};

const EMPTY_LOGIN_BUCKETS: AdminLoginRecencyBuckets = {
  h12: 0,
  h24: 0,
  d7: 0,
  d30: 0,
  d90: 0,
  d180: 0,
  d365: 0,
};

const EMPTY_BY_CATEGORY = (): AdminRevenueByCategory => ({
  SERVICE_CHECKOUT: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
  CLIENT_PLATFORM_SUBSCRIPTION: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
  TRAINER_PREMIUM_SUBSCRIPTION: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
  ONE_TIME_PURCHASE: { revenueCents: 0, grossProfitCents: 0, eventCount: 0 },
});

const BG_FAILED_STATUSES = ["DENIED", "NEEDS_FURTHER_REVIEW", "REJECTED", "CONSIDER", "PENDING_REVIEW"];

const RLS_ADVISORY_TABLE_COUNT = 0;

type CountRow = { n: bigint };

function n(row: CountRow | undefined): number {
  return Number(row?.n ?? BigInt(0));
}

function isRecoverableAdminMetricsError(e: unknown): boolean {
  if (isMissingClientPlatformTrialColumnError(e)) return true;
  if (isMissingTrainerRegisterSchemaError(e)) return true;
  if (isPrismaMissingTableError(e, "pending_client_registrations")) return true;
  if (e instanceof Prisma.PrismaClientValidationError) return true;
  return false;
}

async function safeClientCount(where: Prisma.ClientWhereInput, fallback = 0): Promise<number> {
  try {
    return await prisma.client.count({ where });
  } catch (e) {
    if (isRecoverableAdminMetricsError(e)) {
      console.warn("[admin metrics] client count fallback", e);
      return fallback;
    }
    throw e;
  }
}

async function safeTrainerCount(where: Prisma.TrainerWhereInput, fallback = 0): Promise<number> {
  try {
    return await prisma.trainer.count({ where });
  } catch (e) {
    if (isRecoverableAdminMetricsError(e)) {
      console.warn("[admin metrics] trainer count fallback", e);
      return fallback;
    }
    throw e;
  }
}

async function safePendingClientRegistrationStats(now: Date): Promise<{ total: number; byStatus: Record<string, number> }> {
  try {
    return await getActivePendingClientRegistrationStats(now);
  } catch (e) {
    if (isRecoverableAdminMetricsError(e)) {
      console.warn("[admin metrics] pending client registration fallback", e);
      return { total: 0, byStatus: {} };
    }
    throw e;
  }
}

async function countTrainersBeforeRegistrationPayment(): Promise<number> {
  try {
    return await prisma.trainer.count({ where: launchTrainerBeforeRegistrationPaymentWhere() });
  } catch (e) {
    if (!isRecoverableAdminMetricsError(e)) throw e;
    console.warn("[admin metrics] trainer pre-registration payment fallback to legacy background-fee filter", e);
    return safeTrainerCount({
      ...launchTrainerCountWhere(),
      profile: { is: { hasPaidBackgroundFee: false, backgroundCheckStatus: "NOT_STARTED" } },
    });
  }
}

async function countClientFreeTrialBreakdown(now: Date): Promise<{
  total: number;
  platform: number;
  stripe: number;
}> {
  try {
    const [total, platform, stripe] = await Promise.all([
      prisma.client.count({ where: launchClientFreeTrialCountWhere(now) }),
      prisma.client.count({ where: launchClientPlatformTrialCountWhere(now) }),
      prisma.client.count({ where: launchClientStripeTrialCountWhere() }),
    ]);
    return { total, platform, stripe };
  } catch (e) {
    if (!isRecoverableAdminMetricsError(e)) throw e;
    console.warn("[admin metrics] free trial fallback to Stripe-only counts", e);
    const stripe = await safeClientCount(launchClientStripeTrialCountWhere());
    return { total: stripe, platform: 0, stripe };
  }
}

function sinceFromWindow(key: AdminFinanceWindowKey, now = new Date()): Date {
  return new Date(now.getTime() - FINANCE_WINDOW_MS[key]);
}

function emptyFinanceWindow(): AdminFinanceWindowSnapshot {
  return {
    revenueCents: 0,
    grossProfitCents: 0,
    byCategory: EMPTY_BY_CATEGORY(),
    platformFeesCents: 0,
    leadingRevenueFactor: null,
  };
}

function severityFromCount(count: number, criticalAt: number, warningAt: number): AdminAlertSeverity {
  if (count >= criticalAt) return "critical";
  if (count >= warningAt) return "warning";
  return "info";
}

async function countAnalyticsPageViews(paths: string[] | null, since?: Date): Promise<number> {
  try {
    if (paths && paths.length > 0) {
      const rows = await prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM site_analytics_events
        WHERE kind = 'PAGE_VIEW'
          AND path = ANY(${paths})
          ${since ? Prisma.sql`AND "createdAt" >= ${since}` : Prisma.empty}
      `;
      return n(rows[0]);
    }
    const rows = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM site_analytics_events
      WHERE kind = 'PAGE_VIEW'
        ${since ? Prisma.sql`AND "createdAt" >= ${since}` : Prisma.empty}
    `;
    return n(rows[0]);
  } catch (e) {
    if (isPrismaMissingTableError(e, "site_analytics_events")) return 0;
    throw e;
  }
}

async function countAnalyticsDistinct(paths: string[] | null, since?: Date): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT "visitorId")::bigint AS n FROM site_analytics_events
      WHERE kind = 'PAGE_VIEW'
        ${paths && paths.length > 0 ? Prisma.sql`AND path = ANY(${paths})` : Prisma.empty}
        ${since ? Prisma.sql`AND "createdAt" >= ${since}` : Prisma.empty}
    `;
    return n(rows[0]);
  } catch (e) {
    if (isPrismaMissingTableError(e, "site_analytics_events")) return 0;
    throw e;
  }
}

async function countActiveOnSiteNow(): Promise<number> {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  try {
    const rows = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT "sessionId")::bigint AS n
      FROM site_analytics_events
      WHERE "createdAt" >= ${since}
    `;
    return n(rows[0]);
  } catch (e) {
    if (isPrismaMissingTableError(e, "site_analytics_events")) return 0;
    throw e;
  }
}

async function analyticsAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM site_analytics_events LIMIT 1`;
    return true;
  } catch (e) {
    if (isPrismaMissingTableError(e, "site_analytics_events")) return false;
    throw e;
  }
}

async function countLoginBuckets(table: "clients" | "trainers"): Promise<AdminLoginRecencyBuckets> {
  const alias = table === "clients" ? "c" : "t";
  const metricsFilter =
    table === "clients"
      ? buildLaunchMetricsClientSqlFilter(alias)
      : buildLaunchMetricsTrainerSqlFilter(alias);
  try {
    const rows = await prisma.$queryRaw<
      {
        h12: bigint;
        h24: bigint;
        d7: bigint;
        d30: bigint;
        d90: bigint;
        d180: bigint;
        d365: bigint;
      }[]
    >`
      SELECT
        COUNT(*) FILTER (WHERE ${Prisma.raw(`"${alias}"."lastLoginAt"`)} >= NOW() - INTERVAL '12 hours')::bigint AS h12,
        COUNT(*) FILTER (WHERE ${Prisma.raw(`"${alias}"."lastLoginAt"`)} >= NOW() - INTERVAL '24 hours')::bigint AS h24,
        COUNT(*) FILTER (WHERE ${Prisma.raw(`"${alias}"."lastLoginAt"`)} >= NOW() - INTERVAL '7 days')::bigint AS d7,
        COUNT(*) FILTER (WHERE ${Prisma.raw(`"${alias}"."lastLoginAt"`)} >= NOW() - INTERVAL '30 days')::bigint AS d30,
        COUNT(*) FILTER (WHERE ${Prisma.raw(`"${alias}"."lastLoginAt"`)} >= NOW() - INTERVAL '90 days')::bigint AS d90,
        COUNT(*) FILTER (WHERE ${Prisma.raw(`"${alias}"."lastLoginAt"`)} >= NOW() - INTERVAL '180 days')::bigint AS d180,
        COUNT(*) FILTER (WHERE ${Prisma.raw(`"${alias}"."lastLoginAt"`)} >= NOW() - INTERVAL '365 days')::bigint AS d365
      FROM ${Prisma.raw(`"${table}"`)} ${Prisma.raw(`"${alias}"`)}
      WHERE ${Prisma.raw(`"${alias}"."deidentifiedAt"`)} IS NULL
        AND ${Prisma.raw(`"${alias}"."lastLoginAt"`)} IS NOT NULL
        ${metricsFilter}
    `;
    const r = rows[0];
    return {
      h12: Number(r?.h12 ?? 0),
      h24: Number(r?.h24 ?? 0),
      d7: Number(r?.d7 ?? 0),
      d30: Number(r?.d30 ?? 0),
      d90: Number(r?.d90 ?? 0),
      d180: Number(r?.d180 ?? 0),
      d365: Number(r?.d365 ?? 0),
    };
  } catch (e) {
    if (isPrismaMissingColumnError(e, "lastLoginAt")) return EMPTY_LOGIN_BUCKETS;
    throw e;
  }
}

async function countTopPlatformFunctions(role: "client" | "trainer"): Promise<AdminPlatformFunctionStat[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const stats: { key: string; label: string; count: number }[] = [];

  if (role === "client") {
    const [browse, bookings, chat, questionnaires] = await Promise.all([
      prisma.clientTrainerBrowsePass.count({ where: { createdAt: { gte: since }, client: launchClientCountWhere() } }),
      prisma.bookedTrainingSession.count({ where: { createdAt: { gte: since }, client: launchClientCountWhere() } }),
      prisma.trainerClientChatMessage.count({
        where: { createdAt: { gte: since }, authorRole: "CLIENT", conversation: { client: launchClientCountWhere() } },
      }),
      prisma.clientDailyQuestionnaire.count({ where: { createdAt: { gte: since }, client: launchClientCountWhere() } }),
    ]);
    stats.push(
      { key: "browse_trainers", label: "Find Trainers (swipes)", count: browse },
      { key: "book_sessions", label: "Book training sessions", count: bookings },
      { key: "chat", label: "Chat messages", count: chat },
      { key: "daily_questionnaire", label: "Daily questionnaires", count: questionnaires },
    );
  } else {
    const [posts, bookings, chat, browse] = await Promise.all([
      prisma.trainerFitHubPost.count({ where: { createdAt: { gte: since }, trainer: launchTrainerCountWhere() } }),
      prisma.bookedTrainingSession.count({ where: { createdAt: { gte: since }, trainer: launchTrainerCountWhere() } }),
      prisma.trainerClientChatMessage.count({
        where: { createdAt: { gte: since }, authorRole: "TRAINER", conversation: { trainer: launchTrainerCountWhere() } },
      }),
      prisma.trainerClientBrowsePass.count({ where: { createdAt: { gte: since }, trainer: launchTrainerCountWhere() } }),
    ]);
    stats.push(
      { key: "fithub_posts", label: "FitHub posts", count: posts },
      { key: "book_sessions", label: "Booked sessions", count: bookings },
      { key: "chat", label: "Chat messages", count: chat },
      { key: "discover_clients", label: "Client discovery passes", count: browse },
    );
  }

  return stats
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map(({ key, label, count }) => ({ key, label, count }));
}

export async function getAdminTrafficFunnelPanel(now = new Date()): Promise<AdminTrafficFunnelPanel> {
  const analyticsOk = await analyticsAvailable();
  const freeTrialPromise = countClientFreeTrialBreakdown(now);
  const [
    homepageVisits,
    totalSiteVisits,
    clientSignupPageViews,
    trainerSignupPageViews,
    clientSignupVisitors,
    trainerSignupVisitors,
    activeOnSiteNow,
    clientLoginsByRecency,
    trainerLoginsByRecency,
    pendingClientRegistrations,
    clientsTotal,
    trainersTotal,
    incompleteTrainerSignups,
    trainersBeforeRegistrationPayment,
    trainersBeforeTerms,
    clientsInPlatformPaymentGrace,
    activeClientSubscriptions,
    topClientFunctions,
    topTrainerFunctions,
    freeTrial,
  ] = await Promise.all([
    countAnalyticsPageViews(["/"]),
    countAnalyticsPageViews(null),
    countAnalyticsPageViews(CLIENT_SIGNUP_PATHS),
    countAnalyticsPageViews(TRAINER_SIGNUP_PATHS),
    countAnalyticsDistinct(CLIENT_SIGNUP_PATHS),
    countAnalyticsDistinct(TRAINER_SIGNUP_PATHS),
    countActiveOnSiteNow(),
    countLoginBuckets("clients"),
    countLoginBuckets("trainers"),
    safePendingClientRegistrationStats(now),
    safeClientCount(launchClientCountWhere()),
    safeTrainerCount(launchTrainerCountWhere()),
    safeTrainerCount(launchTrainerIncompleteSignupWhere()),
    countTrainersBeforeRegistrationPayment(),
    safeTrainerCount(launchTrainerBeforeTermsWhere()),
    safeClientCount(launchClientPlatformPaymentGraceWhere(now)),
    countLaunchPlatformSubscribers(),
    countTopPlatformFunctions("client"),
    countTopPlatformFunctions("trainer"),
    freeTrialPromise,
  ]);

  const pendingTotal = pendingClientRegistrations.total;
  const pendingStatusMap = pendingClientRegistrations.byStatus;

  return {
    homepageVisits,
    totalSiteVisits,
    clientSignupPageViews,
    clientsReachedSignupWithoutAccount: Math.max(0, clientSignupVisitors - clientsTotal + pendingTotal),
    trainerSignupPageViews,
    trainersReachedSignupWithoutAccount: Math.max(0, trainerSignupVisitors - trainersTotal),
    activeOnSiteNow,
    clientLoginsByRecency,
    trainerLoginsByRecency,
    pendingClientRegistrations: { total: pendingTotal, byStatus: pendingStatusMap },
    incompleteTrainerSignups,
    trainersBeforeRegistrationPayment,
    trainersBeforeTerms,
    clientsInFreeTrial: freeTrial.total,
    clientsInPlatformTrial: freeTrial.platform,
    clientsInStripeTrial: freeTrial.stripe,
    clientsInPlatformPaymentGrace,
    activeClientSubscriptions,
    topClientFunctions,
    topTrainerFunctions,
    analyticsAvailable: analyticsOk,
  };
}

export async function getAdminSiteActivityPanel(): Promise<AdminSiteActivityPanel> {
  const [clientLoginsByRecency, trainerLoginsByRecency, topClientFunctions, topTrainerFunctions, activeMembersNow] =
    await Promise.all([
      countLoginBuckets("clients"),
      countLoginBuckets("trainers"),
      countTopPlatformFunctions("client"),
      countTopPlatformFunctions("trainer"),
      countActiveMembersNow(),
    ]);

  return {
    activeMembersNow,
    clientLoginsByRecency,
    trainerLoginsByRecency,
    topClientFunctions,
    topTrainerFunctions,
  };
}

async function countActiveMembersNow(): Promise<number> {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  try {
    const rows = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT "visitorId")::bigint AS n
      FROM site_analytics_events
      WHERE kind = 'PAGE_VIEW'
        AND "createdAt" >= ${since}
        AND (
          path LIKE '/client/dashboard%'
          OR path LIKE '/trainer/dashboard%'
        )
    `;
    return n(rows[0]);
  } catch {
    return 0;
  }
}

export async function getAdminClientPipelinePanel(now = new Date()): Promise<AdminClientPipelinePanel> {
  const ownerTestSignupWhere = ownerTestExcludedSignupProgressWhere("client");
  const ownerTestPendingWhere = ownerTestExcludedPendingRegistrationWhere();
  const pendingRegistrationWhere = {
    AND: [activePendingClientRegistrationWhere(now), ownerTestPendingWhere],
  };

  const [startedSignup, basicInfoNoTos, freeTrial, progressRows, pendingRegs] = await Promise.all([
    prisma.signupFormProgress
      .count({ where: { role: "client", stage: "started_signup", ...ownerTestSignupWhere } })
      .catch(() => 0),
    prisma.signupFormProgress
      .count({ where: { role: "client", stage: "basic_info_complete", ...ownerTestSignupWhere } })
      .catch(() => 0),
    safeClientCount(launchClientFreeTrialCountWhere(now)),
    prisma.signupFormProgress
      .findMany({
        where: {
          role: "client",
          stage: { in: ["started_signup", "basic_info_complete"] },
          ...ownerTestSignupWhere,
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      })
      .catch(() => []),
    prisma.pendingClientRegistration.findMany({
      where: pendingRegistrationWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        status: true,
      },
    }),
  ]);

  const entries = [
    ...filterOwnerTestIdentities(progressRows, (row) => ({
      username: row.username,
      email: row.email,
      role: "client" as const,
    })).map((row) => {
      const fields = parseSignupFieldsJson(row.fieldsJson);
      const { filled, missing } = listFilledSignupFields("client", fields);
      return {
        id: row.id,
        label: row.email || row.username || row.visitorId.slice(0, 8),
        email: row.email,
        username: row.username,
        role: "client" as const,
        filledFields: filled,
        missingFields: missing,
        createdAt: row.updatedAt.toISOString(),
      };
    }),
    ...filterOwnerTestIdentities(pendingRegs, (row) => ({
      username: row.username,
      email: row.email,
      role: "client" as const,
    })).map((row) => ({
      id: row.id,
      label: `${row.firstName} ${row.lastName}`.trim() || row.username,
      email: row.email,
      username: row.username,
      role: "client" as const,
      filledFields: signupFieldsForRole("client").filter((f) => f !== "agreedToTerms") as string[],
      missingFields: ["agreedToTerms"],
      createdAt: row.createdAt.toISOString(),
    })),
  ];

  return {
    stages: [
      { id: "started_signup", label: "Started Sign Up", count: startedSignup + pendingRegs.length },
      { id: "basic_info_no_tos", label: "Basic Info Complete, ToS Not Signed", count: basicInfoNoTos },
      { id: "free_trial", label: "Clients in Free Trial", count: freeTrial },
    ],
    entries,
  };
}

export async function getAdminPremiumTrainerActivityPanel(now = new Date()): Promise<AdminPremiumTrainerActivityPanel> {
  const dayKey = todayFeaturedDayKey(now);
  const since30d = sinceFromWindow("30d", now);

  const [premiumTrainers, featuredSlotsToday, activeAdvertisements, tokenRevenue, recentBids] = await Promise.all([
    countLaunchPremiumTrainers(),
    prisma.featuredDailyAllocation.count({ where: { displayDayKey: dayKey } }),
    prisma.trainerFitHubPostPromotion.count({
      where: {
        endsAt: { gt: now },
        trainer: launchTrainerCountWhere(),
      },
    }),
    prisma.platformRevenueEvent
      .aggregate({
        where: mergeLiveRevenueWhere({
          category: "ONE_TIME_PURCHASE",
          createdAt: { gte: since30d },
          metaJson: { contains: "trainer_promo_tokens" },
        }),
        _sum: { revenueCents: true },
      })
      .then((r) => r._sum.revenueCents ?? 0)
      .catch(() => 0),
    prisma.featuredPlacementBid.findMany({
      where: { displayDayKey: dayKey },
      orderBy: { amountCents: "desc" },
      take: 8,
      select: {
        amountCents: true,
        regionZipPrefix: true,
        displayDayKey: true,
        trainer: { select: { username: true } },
      },
    }),
  ]);

  return {
    premiumTrainers,
    featuredSlotsToday,
    activeAdvertisements,
    tokenRevenueCents: tokenRevenue,
    recentBids: recentBids.map((b) => ({
      trainerUsername: b.trainer.username,
      regionZipPrefix: b.regionZipPrefix,
      amountCents: b.amountCents,
      displayDayKey: b.displayDayKey,
    })),
  };
}

export { getAdminEmailStatsPanel };

export async function getAdminTrainerPipelinePanel(): Promise<AdminTrainerPipelinePanel> {
  await repairStaleTrainerPendingRecords().catch((e) => {
    console.warn("[admin trainer pipeline] pending record repair skipped:", e);
  });

  const trainerMetricsFilter = buildAdminPortalTrainerSqlFilter();
  const baseWhere = Prisma.sql`t."deidentifiedAt" IS NULL ${trainerMetricsFilter}`;

  const ownerTestTrainerSignupWhere = ownerTestExcludedSignupProgressWhere("trainer");

  const pendingTrainerCountPromise = prisma.trainer.count({ where: adminPendingTrainerWhere() });

  const [startedSignup, basicInfoNoTos, pendingTrainerCount, bgSubmitted, bgFailed, bgPassed, docsPending, live, pendingTrainerRows] =
    await Promise.all([
    prisma.signupFormProgress
      .count({ where: { role: "trainer", stage: "started_signup", ...ownerTestTrainerSignupWhere } })
      .catch(() => 0),
    prisma.signupFormProgress
      .count({ where: { role: "trainer", stage: "basic_info_complete", ...ownerTestTrainerSignupWhere } })
      .catch(() => 0),
    pendingTrainerCountPromise,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM trainers t
      LEFT JOIN trainer_profiles p ON p."trainerId" = t.id
      WHERE ${baseWhere}
        AND (
          p."checkrReportId" IS NOT NULL
          OR (p."backgroundCheckStatus" IS NOT NULL AND p."backgroundCheckStatus" <> 'NOT_STARTED' AND p."backgroundCheckStatus" <> 'APPROVED')
        )
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM trainers t
      INNER JOIN trainer_profiles p ON p."trainerId" = t.id
      WHERE ${baseWhere}
        AND (
          p."backgroundCheckStatus" IN (${Prisma.join(BG_FAILED_STATUSES.map((s) => Prisma.sql`${s}`))})
          OR p."backgroundCheckReviewStatus" IN (${Prisma.join(BG_FAILED_STATUSES.map((s) => Prisma.sql`${s}`))})
        )
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM trainers t
      INNER JOIN trainer_profiles p ON p."trainerId" = t.id
      WHERE ${baseWhere} AND p."backgroundCheckStatus" = 'APPROVED'
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM trainers t
      INNER JOIN trainer_profiles p ON p."trainerId" = t.id
      WHERE ${baseWhere}
        AND (
          (p."certificationUrl" IS NOT NULL AND p."certificationReviewStatus" <> 'APPROVED')
          OR (p."nutritionistCertificationUrl" IS NOT NULL AND p."nutritionistCertificationReviewStatus" <> 'APPROVED')
          OR (p."specialistCertificationUrl" IS NOT NULL AND p."specialistCertificationReviewStatus" <> 'APPROVED')
          OR (p."otherCertificationUrl" IS NOT NULL AND p."otherCertificationReviewStatus" <> 'APPROVED')
        )
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM trainers t
      INNER JOIN trainer_profiles p ON p."trainerId" = t.id
      WHERE ${baseWhere} AND p."dashboardActivatedAt" IS NOT NULL
    `,
    prisma.trainer.findMany({
      where: adminPendingTrainerWhere(),
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        id: true,
        username: true,
        preferredName: true,
        firstName: true,
        lastName: true,
        termsAcceptedAt: true,
        deidentifiedAt: true,
        profile: {
          select: {
            hasSignedTOS: true,
            complianceWindowStartedAt: true,
            hasPaidRegistrationFee: true,
            registrationFeeHoldStatus: true,
            backgroundCheckStatus: true,
            backgroundCheckReviewStatus: true,
            certificationReviewStatus: true,
            nutritionistCertificationReviewStatus: true,
            specialistCertificationReviewStatus: true,
            otherCertificationReviewStatus: true,
            certificationUrl: true,
            nutritionistCertificationUrl: true,
            specialistCertificationUrl: true,
            otherCertificationUrl: true,
          },
        },
      },
    }),
  ]);

  const totalInPipeline = pendingTrainerCount;
  const pct = (count: number) => (totalInPipeline > 0 ? Math.round((count / totalInPipeline) * 1000) / 10 : 0);

  const stages: AdminTrainerPipelineStage[] = [
    { id: "started_signup", label: "Started Sign Up", count: startedSignup, percentOfSignup: pct(startedSignup) },
    {
      id: "basic_info_no_tos",
      label: "Basic Info Complete, ToS Not Signed",
      count: basicInfoNoTos,
      percentOfSignup: pct(basicInfoNoTos),
    },
    { id: "signup", label: "Pending Trainers (Onboarding)", count: pendingTrainerCount, percentOfSignup: pct(pendingTrainerCount) },
    { id: "bg_submitted", label: "Background Check Submitted/Pending", count: n(bgSubmitted[0]), percentOfSignup: pct(n(bgSubmitted[0])) },
    { id: "bg_review", label: "Background Check Submitted/In Review", count: n(bgFailed[0]), percentOfSignup: pct(n(bgFailed[0])) },
    { id: "bg_passed", label: "Background Check Passed", count: n(bgPassed[0]), percentOfSignup: pct(n(bgPassed[0])) },
    { id: "docs_pending", label: "Documents Uploaded/Not Approved", count: n(docsPending[0]), percentOfSignup: pct(n(docsPending[0])) },
    { id: "live", label: "Documents Approved/LIVE", count: n(live[0]), percentOfSignup: pct(n(live[0])) },
  ];

  const pendingTrainers: AdminTrainerPipelineEntry[] = filterOwnerTestIdentities(
    pendingTrainerRows,
    (t) => ({ username: t.username, role: "trainer" }),
  ).map((t) => {
    const qualifications = buildTrainerPendingQualifications({
      termsAcceptedAt: t.termsAcceptedAt,
      profile: t.profile,
    });
    return {
      trainerId: t.id,
      username: t.username,
      displayName:
        t.preferredName?.trim() || [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.username,
      deidentified: Boolean(t.deidentifiedAt),
      ...qualifications,
    };
  });

  return { totalInPipeline, stages, pendingTrainers };
}

async function loadFinanceWindow(since: Date | null): Promise<AdminFinanceWindowSnapshot> {
  const where = since
    ? mergeLiveRevenueWhere({ createdAt: { gte: since } })
    : LIVE_PLATFORM_REVENUE_WHERE;
  try {
    const [grouped, feeRows] = await Promise.all([
      prisma.platformRevenueEvent.groupBy({
        by: ["category"],
        where,
        _sum: { revenueCents: true, grossProfitCents: true },
        _count: { _all: true },
      }),
      since
        ? prisma.trainerClientServiceTransaction.aggregate({
            where: {
              completedAt: { gte: since },
              client: launchClientCountWhere(),
              trainer: launchTrainerCountWhere(),
            },
            _sum: { adminFeeCents: true },
          })
        : prisma.trainerClientServiceTransaction.aggregate({
            where: {
              client: launchClientCountWhere(),
              trainer: launchTrainerCountWhere(),
            },
            _sum: { adminFeeCents: true },
          }),
    ]);

    const byCategory = EMPTY_BY_CATEGORY();
    let revenueCents = 0;
    let grossProfitCents = 0;
    for (const row of grouped) {
      const cat = row.category as PlatformRevenueCategory;
      if (!(cat in byCategory)) continue;
      const rev = row._sum.revenueCents ?? 0;
      const profit = row._sum.grossProfitCents ?? 0;
      byCategory[cat] = { revenueCents: rev, grossProfitCents: profit, eventCount: row._count._all };
      revenueCents += rev;
      grossProfitCents += profit;
    }

    let leading: AdminFinanceWindowSnapshot["leadingRevenueFactor"] = null;
    for (const [category, v] of Object.entries(byCategory)) {
      if (!leading || v.grossProfitCents > leading.grossProfitCents) {
        leading = { category, grossProfitCents: v.grossProfitCents };
      }
    }

    return {
      revenueCents,
      grossProfitCents,
      byCategory,
      platformFeesCents: feeRows._sum.adminFeeCents ?? 0,
      leadingRevenueFactor: leading,
    };
  } catch (e) {
    if (isPrismaMissingTableError(e, "platform_revenue_events")) return emptyFinanceWindow();
    throw e;
  }
}

async function loadRecentTransactions(limit = 20): Promise<AdminFinanceRecentTransaction[]> {
  const [platformRows, serviceRows] = await Promise.all([
    prisma.platformRevenueEvent.findMany({
      where: LIVE_PLATFORM_REVENUE_WHERE,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        category: true,
        revenueCents: true,
        grossProfitCents: true,
        clientId: true,
        trainerId: true,
      },
    }),
    prisma.trainerClientServiceTransaction.findMany({
      where: {
        client: launchClientCountWhere(),
        trainer: launchTrainerCountWhere(),
      },
      orderBy: { completedAt: "desc" },
      take: limit,
      select: {
        id: true,
        completedAt: true,
        totalChargedCents: true,
        amountCents: true,
        adminFeeCents: true,
        purchaseLabelSnapshot: true,
        clientId: true,
        trainerId: true,
      },
    }),
  ]);

  const merged: AdminFinanceRecentTransaction[] = [
    ...platformRows.map((r) => ({
      id: `pre:${r.id}`,
      source: "platform_revenue" as const,
      occurredAt: r.createdAt.toISOString(),
      label: r.category.replace(/_/g, " "),
      amountCents: r.revenueCents,
      grossProfitCents: r.grossProfitCents,
      clientId: r.clientId,
      trainerId: r.trainerId,
    })),
    ...serviceRows.map((r) => ({
      id: `svc:${r.id}`,
      source: "service_checkout" as const,
      occurredAt: r.completedAt.toISOString(),
      label: r.purchaseLabelSnapshot ?? "Service checkout",
      amountCents: r.totalChargedCents ?? r.amountCents,
      grossProfitCents: r.adminFeeCents ?? 0,
      clientId: r.clientId,
      trainerId: r.trainerId,
    })),
  ];

  return merged.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit);
}

function parseTopOfferingFromProfile(serviceOfferingsJson: string | null): string | null {
  return parseTopOffering(serviceOfferingsJson);
}

async function loadBestSellers(since: Date): Promise<AdminFinanceBestSeller[]> {
  const grouped = await prisma.trainerClientServiceTransaction.groupBy({
    by: ["trainerId"],
    where: {
      completedAt: { gte: since },
      client: launchClientCountWhere(),
      trainer: launchTrainerCountWhere(),
    },
    _sum: { amountCents: true, totalChargedCents: true },
    _count: { _all: true },
    orderBy: { _sum: { amountCents: "desc" } },
    take: 5,
  });
  if (grouped.length === 0) return [];

  const trainerIds = grouped.map((g) => g.trainerId);
  const trainers = await prisma.trainer.findMany({
    where: { id: { in: trainerIds }, ...launchTrainerCountWhere() },
    select: {
      id: true,
      username: true,
      preferredName: true,
      firstName: true,
      lastName: true,
      profile: { select: { serviceOfferingsJson: true } },
    },
  });
  const byId = new Map(trainers.map((t) => [t.id, t]));

  return grouped.map((g) => {
    const t = byId.get(g.trainerId);
    const displayName =
      t?.preferredName?.trim() ||
      [t?.firstName, t?.lastName].filter(Boolean).join(" ").trim() ||
      t?.username ||
      g.trainerId;
    return {
      trainerId: g.trainerId,
      username: t?.username ?? "unknown",
      displayName,
      volumeCents: Number(g._sum.totalChargedCents ?? g._sum.amountCents ?? 0),
      transactionCount: g._count._all,
      topOfferingName: parseTopOfferingFromProfile(t?.profile?.serviceOfferingsJson ?? null),
    };
  });
}

function todayFeaturedDayKey(now = new Date()): string {
  return homepageDisplayDayKey(now);
}

export async function getAdminFinancesPanel(now = new Date()): Promise<AdminFinancesPanel> {
  const windowKeys = Object.keys(FINANCE_WINDOW_MS) as AdminFinanceWindowKey[];
  const windowEntries = await Promise.all(
    windowKeys.map(async (key) => [key, await loadFinanceWindow(sinceFromWindow(key, now))] as const),
  );
  const windows = Object.fromEntries(windowEntries) as Record<AdminFinanceWindowKey, AdminFinanceWindowSnapshot>;

  const lifetimeGrouped = await loadFinanceWindow(null);
  const lifetimeEvents = await prisma.platformRevenueEvent
    .count({ where: LIVE_PLATFORM_REVENUE_WHERE })
    .catch(() => 0);

  const dayKey = todayFeaturedDayKey();
  const freeTrialPromise = countClientFreeTrialBreakdown(now);
  const [
    freeTrial,
    clientsInPlatformPaymentGrace,
    paymentFailedInGrace,
    clientsWithCard,
    activeSubscriptions,
    recentTransactions,
    premiumTrainers,
    featuredTrainersToday,
    bestSellers,
  ] = await Promise.all([
    freeTrialPromise,
    safeClientCount(launchClientPlatformPaymentGraceWhere(now)),
    safeClientCount(launchClientBillingGraceWhere(now)),
    safeClientCount(launchClientWithCardWhere()),
    countLaunchPlatformSubscribers(),
    loadRecentTransactions(20),
    countLaunchPremiumTrainers(),
    prisma.featuredDailyAllocation.count({ where: { displayDayKey: dayKey } }),
    loadBestSellers(sinceFromWindow("30d", now)),
  ]);

  return {
    windows,
    lifetime: { ...lifetimeGrouped, eventCount: lifetimeEvents },
    clientsInFreeTrial: freeTrial.total,
    clientsInPlatformTrial: freeTrial.platform,
    clientsInStripeTrial: freeTrial.stripe,
    clientsInPlatformPaymentGrace,
    pendingSubscriptionStop: null,
    paymentFailedInGrace,
    clientsWithCard,
    activeSubscriptions,
    recentTransactions,
    premiumTrainers,
    trainersWithCard: null,
    featuredTrainersToday,
    bestSellers,
  };
}

const ADMIN_ALERTS_LIST_LIMIT = 100;

function formatAlertFilingDate(iso: string | null | undefined): string {
  if (!iso) return "Undated";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Undated";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function trainerDisplayName(args: {
  username: string;
  preferredName: string | null;
  firstName: string | null;
  lastName: string | null;
}): string {
  const legal = [args.firstName, args.lastName].filter(Boolean).join(" ").trim();
  return args.preferredName?.trim() || legal || `@${args.username}`;
}

function reporterLabel(args: {
  anonymous: boolean;
  reporterName: string | null;
  reporterEmail: string | null;
}): string {
  if (args.anonymous) return "Anonymous reporter";
  const name = args.reporterName?.trim();
  const email = args.reporterEmail?.trim();
  if (name && email) return `${name} (${email})`;
  return name || email || "Unknown reporter";
}

function parseChatSignals(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map((value) => String(value)) : [];
  } catch {
    return [];
  }
}

async function loadAlertGroup(
  id: string,
  label: string,
  description: string,
  severity: AdminAlertSeverity,
  items: AdminAlertItem[],
  total: number,
): Promise<AdminAlertGroup> {
  return { id, label, description, severity, items, total };
}

export async function getAdminAlertsPanel(): Promise<AdminAlertsPanel> {
  const failedBgWhere = {
    ...launchTrainerCountWhere(),
    profile: {
      is: {
        OR: [
          { backgroundCheckStatus: { in: ["DENIED", "NEEDS_FURTHER_REVIEW"] } },
          { backgroundCheckReviewStatus: { in: ["DENIED", "NEEDS_FURTHER_REVIEW", "REJECTED"] } },
        ],
      },
    },
  };

  const chatContactWhere = {
    status: "PENDING" as const,
    OR: [
      { matchedSignalsJson: { contains: "phone" } },
      { matchedSignalsJson: { contains: "email" } },
      { matchedSignalsJson: { contains: "PHONE" } },
      { matchedSignalsJson: { contains: "EMAIL" } },
    ],
  };

  const [
    failedBgTrainers,
    failedBgTotal,
    bugReports,
    bugReportsTotal,
    productIdeas,
    productIdeasTotal,
    failedPayments,
    failedPaymentsTotal,
    suspendedClientRows,
    suspendedTrainerRows,
    suspendedClientsTotal,
    suspendedTrainersTotal,
    safetyReports,
    safetyReportsTotal,
    chatContactWarnings,
    pendingChatReviewsTotal,
    openDisputes,
    openDisputesTotal,
  ] = await Promise.all([
    prisma.trainer.findMany({
      where: failedBgWhere,
      take: ADMIN_ALERTS_LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        preferredName: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        profile: { select: { backgroundCheckStatus: true, backgroundCheckReviewStatus: true } },
      },
    }),
    prisma.trainer.count({ where: failedBgWhere }),
    prisma.clientBugReport.findMany({
      orderBy: { createdAt: "desc" },
      take: ADMIN_ALERTS_LIST_LIMIT,
      select: {
        id: true,
        createdAt: true,
        category: true,
        description: true,
        anonymous: true,
        reporterName: true,
        reporterEmail: true,
      },
    }),
    prisma.clientBugReport.count(),
    prisma.productIdeaSubmission.findMany({
      orderBy: { createdAt: "desc" },
      take: ADMIN_ALERTS_LIST_LIMIT,
      select: {
        id: true,
        createdAt: true,
        category: true,
        description: true,
        anonymous: true,
        reporterName: true,
        reporterEmail: true,
      },
    }),
    prisma.productIdeaSubmission.count(),
    prisma.client.findMany({
      where: launchClientBillingGraceWhere(new Date()),
      take: ADMIN_ALERTS_LIST_LIMIT,
      orderBy: { subscriptionGraceUntil: "asc" },
      select: { id: true, username: true, subscriptionGraceUntil: true, createdAt: true },
    }),
    prisma.client.count({ where: launchClientBillingGraceWhere(new Date()) }),
    prisma.client.findMany({
      where: { safetySuspended: true, ...launchClientCountWhere() },
      take: ADMIN_ALERTS_LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      select: { id: true, username: true, createdAt: true },
    }),
    prisma.trainer.findMany({
      where: { safetySuspended: true, ...launchTrainerCountWhere() },
      take: ADMIN_ALERTS_LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      select: { id: true, username: true, preferredName: true, firstName: true, lastName: true, createdAt: true },
    }),
    prisma.client.count({ where: { safetySuspended: true, ...launchClientCountWhere() } }),
    prisma.trainer.count({ where: { safetySuspended: true, ...launchTrainerCountWhere() } }),
    prisma.safetyReport.findMany({
      where: { status: "PENDING" },
      take: ADMIN_ALERTS_LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        category: true,
        details: true,
        reporterIsTrainer: true,
        reporterId: true,
        subjectIsTrainer: true,
        subjectId: true,
      },
    }),
    prisma.safetyReport.count({ where: { status: "PENDING" } }),
    prisma.chatAdminReviewItem.findMany({
      where: chatContactWhere,
      take: ADMIN_ALERTS_LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        conversationId: true,
        authorRole: true,
        matchedSignalsJson: true,
        bodyExcerpt: true,
      },
    }),
    prisma.chatAdminReviewItem.count({ where: { status: "PENDING" } }),
    prisma.sessionPayoutDispute.findMany({
      where: { status: "PENDING_ADMIN" },
      take: ADMIN_ALERTS_LIST_LIMIT,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        bookedTrainingSessionId: true,
        clientId: true,
        answeredWasRescheduled: true,
        answeredWasCancelled: true,
        answeredReasonDetail: true,
      },
    }),
    prisma.sessionPayoutDispute.count({ where: { status: "PENDING_ADMIN" } }),
  ]);

  const failedBgItems: AdminAlertItem[] = failedBgTrainers.map((trainer) => {
    const bgStatus = trainer.profile?.backgroundCheckStatus ?? "unknown";
    const reviewStatus = trainer.profile?.backgroundCheckReviewStatus ?? "not reviewed";
    const displayName = trainerDisplayName(trainer);
    const createdAt = trainer.createdAt.toISOString();
    return {
      id: trainer.id,
      severity: "critical" as const,
      title: displayName,
      detail: `Background check ${bgStatus.toLowerCase().replaceAll("_", " ")}`,
      fullDetail: `${displayName} (@${trainer.username}) requires background-check review. Screening status is ${bgStatus}; manual review status is ${reviewStatus}.`,
      filingLabel: `Screening · ${formatAlertFilingDate(createdAt)}`,
      fields: [
        { label: "Trainer", value: displayName },
        { label: "Username", value: `@${trainer.username}` },
        { label: "Screening status", value: bgStatus },
        { label: "Review status", value: reviewStatus },
        { label: "Trainer ID", value: trainer.id },
      ],
      href: "/admin",
      createdAt,
    };
  });

  const bugReportItems: AdminAlertItem[] = bugReports.map((report) => {
    const createdAt = report.createdAt.toISOString();
    const reporter = reporterLabel(report);
    return {
      id: report.id,
      severity: "warning" as const,
      title: report.category,
      detail: report.description.slice(0, 120),
      fullDetail: report.description,
      filingLabel: `Bug report · ${formatAlertFilingDate(createdAt)}`,
      fields: [
        { label: "Category", value: report.category },
        { label: "Reporter", value: reporter },
        { label: "Submitted", value: formatAlertFilingDate(createdAt) },
        { label: "Report ID", value: report.id },
      ],
      href: null,
      createdAt,
    };
  });

  const productIdeaItems: AdminAlertItem[] = productIdeas.map((idea) => {
    const createdAt = idea.createdAt.toISOString();
    const reporter = reporterLabel(idea);
    return {
      id: idea.id,
      severity: "info" as const,
      title: idea.category,
      detail: idea.description.slice(0, 120),
      fullDetail: idea.description,
      filingLabel: `Product idea · ${formatAlertFilingDate(createdAt)}`,
      fields: [
        { label: "Category", value: idea.category },
        { label: "Submitter", value: reporter },
        { label: "Submitted", value: formatAlertFilingDate(createdAt) },
        { label: "Submission ID", value: idea.id },
      ],
      href: null,
      createdAt,
    };
  });

  const failedPaymentItems: AdminAlertItem[] = failedPayments.map((client) => {
    const graceUntil = client.subscriptionGraceUntil?.toISOString() ?? null;
    const graceLabel = formatAlertFilingDate(graceUntil);
    return {
      id: client.id,
      severity: "critical" as const,
      title: `@${client.username}`,
      detail: `Grace until ${graceLabel}`,
      fullDetail: `Client @${client.username} is in billing grace. Subscription access remains until ${graceLabel}, after which the account should be treated as inactive unless payment recovers.`,
      filingLabel: `Billing grace · ${graceLabel}`,
      fields: [
        { label: "Client", value: `@${client.username}` },
        { label: "Grace ends", value: graceLabel },
        { label: "Client ID", value: client.id },
      ],
      href: "/admin",
      createdAt: graceUntil,
    };
  });

  const flaggedUserItems: AdminAlertItem[] = [
    ...suspendedClientRows.map((client) => {
      const createdAt = client.createdAt.toISOString();
      return {
        id: `client-suspended-${client.id}`,
        severity: "warning" as const,
        title: `@${client.username}`,
        detail: "Client account on safety hold",
        fullDetail: `Client @${client.username} is suspended for safety review. Restore access only after the safety workflow is complete.`,
        filingLabel: `Safety hold · Client · ${formatAlertFilingDate(createdAt)}`,
        fields: [
          { label: "Account type", value: "Client" },
          { label: "Username", value: `@${client.username}` },
          { label: "Client ID", value: client.id },
          { label: "Suspended since", value: formatAlertFilingDate(createdAt) },
        ],
        href: "/admin",
        createdAt,
      };
    }),
    ...suspendedTrainerRows.map((trainer) => {
      const createdAt = trainer.createdAt.toISOString();
      const displayName = trainerDisplayName(trainer);
      return {
        id: `trainer-suspended-${trainer.id}`,
        severity: "warning" as const,
        title: displayName,
        detail: "Trainer account on safety hold",
        fullDetail: `${displayName} (@${trainer.username}) is suspended for safety review. Restore access only after the safety workflow is complete.`,
        filingLabel: `Safety hold · Trainer · ${formatAlertFilingDate(createdAt)}`,
        fields: [
          { label: "Account type", value: "Trainer" },
          { label: "Trainer", value: displayName },
          { label: "Username", value: `@${trainer.username}` },
          { label: "Trainer ID", value: trainer.id },
          { label: "Suspended since", value: formatAlertFilingDate(createdAt) },
        ],
        href: "/admin",
        createdAt,
      };
    }),
    ...safetyReports.map((report) => {
      const createdAt = report.createdAt.toISOString();
      const reporterType = report.reporterIsTrainer ? "Trainer" : "Client";
      const subjectType = report.subjectIsTrainer ? "Trainer" : "Client";
      return {
        id: report.id,
        severity: "warning" as const,
        title: report.category,
        detail: report.details.slice(0, 120),
        fullDetail: report.details,
        filingLabel: `Safety report · ${formatAlertFilingDate(createdAt)}`,
        fields: [
          { label: "Category", value: report.category },
          { label: "Reporter", value: `${reporterType} · ${report.reporterId}` },
          { label: "Subject", value: `${subjectType} · ${report.subjectId}` },
          { label: "Submitted", value: formatAlertFilingDate(createdAt) },
          { label: "Report ID", value: report.id },
        ],
        href: null,
        createdAt,
      };
    }),
  ].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  const chatWarningItems: AdminAlertItem[] = chatContactWarnings.map((item) => {
    const createdAt = item.createdAt.toISOString();
    const signals = parseChatSignals(item.matchedSignalsJson);
    const signalSummary = signals.length > 0 ? signals.join(", ") : "Contact leakage signal";
    return {
      id: item.id,
      severity: "warning" as const,
      title: "Contact signal detected",
      detail: item.bodyExcerpt.slice(0, 100),
      fullDetail: item.bodyExcerpt,
      filingLabel: `Chat review · ${formatAlertFilingDate(createdAt)}`,
      fields: [
        { label: "Author role", value: item.authorRole },
        { label: "Matched signals", value: signalSummary },
        { label: "Conversation ID", value: item.conversationId },
        { label: "Flagged", value: formatAlertFilingDate(createdAt) },
        { label: "Review ID", value: item.id },
      ],
      href: null,
      createdAt,
    };
  });

  const securityItems: AdminAlertItem[] = [
    ...(RLS_ADVISORY_TABLE_COUNT > 0
      ? [
          {
            id: "rls-advisory",
            severity: "warning" as const,
            title: "RLS advisory",
            detail: `${RLS_ADVISORY_TABLE_COUNT} Supabase tables flagged (internal)`,
            fullDetail: `${RLS_ADVISORY_TABLE_COUNT} Supabase table(s) are flagged by the internal RLS advisory scan. Review row-level security policies before the next production deploy.`,
            filingLabel: "Compliance · RLS advisory",
            fields: [
              { label: "Advisory type", value: "Row-level security" },
              { label: "Tables flagged", value: String(RLS_ADVISORY_TABLE_COUNT) },
            ],
            href: null,
            createdAt: null,
          },
        ]
      : []),
    ...openDisputes.map((dispute) => {
      const createdAt = dispute.createdAt.toISOString();
      const outcome = dispute.answeredWasCancelled
        ? "Client reported cancellation"
        : dispute.answeredWasRescheduled
          ? "Client reported reschedule"
          : "Client reported a payout issue";
      return {
        id: dispute.id,
        severity: "info" as const,
        title: "Payout dispute",
        detail: outcome,
        fullDetail: dispute.answeredReasonDetail,
        filingLabel: `Payout dispute · ${formatAlertFilingDate(createdAt)}`,
        fields: [
          { label: "Outcome reported", value: outcome },
          { label: "Session ID", value: dispute.bookedTrainingSessionId },
          { label: "Client ID", value: dispute.clientId },
          { label: "Opened", value: formatAlertFilingDate(createdAt) },
          { label: "Dispute ID", value: dispute.id },
        ],
        href: null,
        createdAt,
      };
    }),
  ];

  const flaggedUsersTotal = suspendedClientsTotal + suspendedTrainersTotal + safetyReportsTotal;
  const securityTotal = RLS_ADVISORY_TABLE_COUNT + openDisputesTotal;

  const groups: AdminAlertGroup[] = [
    await loadAlertGroup(
      "failed_bg",
      "Failed Background Checks",
      "Trainers blocked by screening or manual review.",
      severityFromCount(failedBgTotal, 3, 1),
      failedBgItems,
      failedBgTotal,
    ),
    await loadAlertGroup(
      "bug_reports",
      "Bug Reports",
      "Client-submitted defects and broken flows.",
      severityFromCount(bugReportsTotal, 10, 3),
      bugReportItems,
      bugReportsTotal,
    ),
    await loadAlertGroup(
      "product_ideas",
      "Product Ideas",
      "Feature requests and product feedback from members.",
      "info",
      productIdeaItems,
      productIdeasTotal,
    ),
    await loadAlertGroup(
      "failed_payments",
      "Failed Payments (Grace)",
      "Clients still inside the billing grace window.",
      severityFromCount(failedPaymentsTotal, 5, 1),
      failedPaymentItems,
      failedPaymentsTotal,
    ),
    await loadAlertGroup(
      "flagged_users",
      "Flagged Users & Safety",
      "Suspended accounts and open safety reports.",
      severityFromCount(flaggedUsersTotal, 5, 1),
      flaggedUserItems,
      flaggedUsersTotal,
    ),
    await loadAlertGroup(
      "chat_warnings",
      "Chat Warnings (PII / Contact Leakage)",
      "Pending chat review items with contact-sharing signals.",
      severityFromCount(chatContactWarnings.length, 3, 1),
      chatWarningItems,
      pendingChatReviewsTotal,
    ),
    await loadAlertGroup(
      "security",
      "Security & Compliance",
      "Payout disputes and internal compliance advisories.",
      RLS_ADVISORY_TABLE_COUNT > 0 || openDisputesTotal > 3 ? "warning" : "info",
      securityItems,
      securityTotal,
    ),
  ];

  return { groups };
}

/**
 * Site stability score (0–100):
 * Starts at 100 and subtracts weighted penalties for open payout disputes, recent bug reports,
 * clients in billing grace, and missing analytics ingest (no events in 24h when table exists).
 */
export async function computePlatformStabilityScore(): Promise<{ score: number; notes: string[] }> {
  const notes: string[] = [];
  let score = 100;
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [openDisputes, bugs7d, graceClients, analyticsEvents24h, analyticsOk] = await Promise.all([
    prisma.sessionPayoutDispute.count({ where: { status: "PENDING_ADMIN" } }),
    prisma.clientBugReport.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    prisma.client.count({ where: launchClientBillingGraceWhere(new Date()) }),
    prisma.siteAnalyticsEvent.count({ where: { createdAt: { gte: since24h } } }).catch(() => -1),
    analyticsAvailable(),
  ]);

  if (openDisputes > 0) {
    const penalty = Math.min(25, openDisputes * 5);
    score -= penalty;
    notes.push(`${openDisputes} open payout dispute(s)`);
  }
  if (bugs7d > 0) {
    const penalty = Math.min(20, bugs7d * 2);
    score -= penalty;
    notes.push(`${bugs7d} bug report(s) in 7d`);
  }
  if (graceClients > 0) {
    const penalty = Math.min(15, graceClients * 3);
    score -= penalty;
    notes.push(`${graceClients} client(s) in billing grace`);
  }
  if (analyticsOk && analyticsEvents24h === 0) {
    score -= 10;
    notes.push("No analytics events in 24h");
  }

  return { score: Math.max(0, Math.min(100, score)), notes };
}

/**
 * Security score (0–100):
 * Weighted blend of 2FA adoption, open safety reports, active suspensions, RLS advisory penalty,
 * and recent administrator audit coverage (impersonation logged in last 30d).
 */
export async function computePlatformSecurityScore(): Promise<{ score: number; notes: string[] }> {
  const notes: string[] = [];
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [clientsTotal, clients2fa, trainersTotal, trainers2fa, openSafety, suspendedClients, suspendedTrainers, audit30d] =
    await Promise.all([
    prisma.client.count({ where: launchClientCountWhere() }),
    prisma.client.count({ where: { ...launchClientCountWhere(), twoFactorEnabled: true } }),
    prisma.trainer.count({ where: launchTrainerCountWhere() }),
    prisma.trainer.count({ where: { ...launchTrainerCountWhere(), twoFactorEnabled: true } }),
    prisma.safetyReport.count({ where: { status: "PENDING" } }),
    prisma.client.count({ where: { safetySuspended: true, ...launchClientCountWhere() } }),
    prisma.trainer.count({ where: { safetySuspended: true, ...launchTrainerCountWhere() } }),
    prisma.administratorAuditLog.count({ where: { createdAt: { gte: since30d } } }),
  ]);
  const suspensions = suspendedClients + suspendedTrainers;

  const totalUsers = clientsTotal + trainersTotal;
  const twoFaRate = totalUsers > 0 ? (clients2fa + trainers2fa) / totalUsers : 0;
  const auditCoverage = Math.min(1, audit30d / 10);

  let score = Math.round(twoFaRate * 35 + auditCoverage * 25 + 40);
  if (openSafety > 0) {
    score -= Math.min(20, openSafety * 4);
    notes.push(`${openSafety} open safety report(s)`);
  }
  if (suspensions > 0) {
    score -= Math.min(15, suspensions * 2);
    notes.push(`${suspensions} active suspension(s)`);
  }
  if (RLS_ADVISORY_TABLE_COUNT > 0) {
    score -= Math.min(10, RLS_ADVISORY_TABLE_COUNT * 2);
    notes.push(`${RLS_ADVISORY_TABLE_COUNT} RLS advisory table(s)`);
  }
  notes.push(`2FA adoption ${Math.round(twoFaRate * 100)}%`);
  notes.push(`${audit30d} admin audit event(s) in 30d`);

  return { score: Math.max(0, Math.min(100, score)), notes };
}

export async function getAdminPlatformSummaryPanel(): Promise<AdminPlatformSummaryPanel> {
  const now = new Date();
  const userCounts = await getHomeUserCounts();
  const [stability, security, lifetime, pipeline, finances, returningRatio] = await Promise.all([
    computePlatformStabilityScore(),
    computePlatformSecurityScore(),
    loadFinanceWindow(null),
    getAdminTrainerPipelinePanel(),
    getAdminFinancesPanel(now),
    (async () => {
      try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const rows = await prisma.$queryRaw<{ visitors: bigint; returning: bigint }[]>`
          WITH v AS (
            SELECT "visitorId", COUNT(*)::int AS visits
            FROM site_analytics_events
            WHERE kind = 'PAGE_VIEW' AND "createdAt" >= ${since}
            GROUP BY "visitorId"
          )
          SELECT
            COUNT(*)::bigint AS visitors,
            COUNT(*) FILTER (WHERE visits > 1)::bigint AS returning
          FROM v
        `;
        const visitors = Number(rows[0]?.visitors ?? 0);
        const returning = Number(rows[0]?.returning ?? 0);
        return visitors > 0 ? returning / visitors : 0;
      } catch {
        return 0;
      }
    })(),
  ]);

  const totalUsers = userCounts.clientsTotal + userCounts.trainersTotal;
  const activeUsers = userCounts.clientsActive + userCounts.trainersActive;
  const launchDays = daysSinceLaunch(now);
  const revenuePerDay = launchDays > 0 ? lifetime.revenueCents / launchDays : lifetime.revenueCents;
  const margin = lifetime.revenueCents > 0 ? lifetime.grossProfitCents / lifetime.revenueCents : 0;
  const liveStage = pipeline.stages.find((s) => s.id === "live");
  const signupStage = pipeline.stages.find((s) => s.id === "signup");
  const trainerCompletion =
    signupStage && signupStage.count > 0 ? (liveStage?.count ?? 0) / signupStage.count : 0;
  const subscriptionConversion =
    userCounts.clientsTotal > 0 ? finances.activeSubscriptions / userCounts.clientsTotal : 0;

  const marketCompetitiveness = computeMarketCompetitivenessProxy({
    clientsTotal: userCounts.clientsTotal,
    trainersTotal: userCounts.trainersTotal,
    trainersLive: liveStage?.count ?? 0,
    featuredToday: finances.featuredTrainersToday,
  });

  const ratingInput = {
    daysSinceLaunch: launchDays,
    totalUsers,
    activeUsers,
    returningVisitorRatio: returningRatio,
    revenuePerDayCents: revenuePerDay,
    grossProfitMargin: margin,
    stabilityScore: stability.score,
    securityScore: security.score,
    trainerPipelineCompletionRate: trainerCompletion,
    subscriptionConversionRate: subscriptionConversion,
    marketCompetitiveness,
    revenue30dCents: finances.windows["30d"].grossProfitCents,
  };

  const successRating = computePlatformSuccessRating(ratingInput);
  const valuation = computePlatformValuation({
    activePlatformSubscribers: finances.activeSubscriptions,
    activeTrainerPremiumSubscribers: finances.premiumTrainers,
    grossProfit30dCents: finances.windows["30d"].grossProfitCents,
    activeUsers,
    successScore: successRating.score,
  });

  const potentialRating = computePlatformPotentialRating(ratingInput);

  const revenue30d = finances.windows["30d"];
  let uniqueVisitors30d = 0;
  try {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const visitorRows = await prisma.$queryRaw<{ visitors: bigint }[]>`
      SELECT COUNT(DISTINCT "visitorId")::bigint AS visitors
      FROM site_analytics_events
      WHERE kind = 'PAGE_VIEW' AND "createdAt" >= ${since30d}
    `;
    uniqueVisitors30d = Number(visitorRows[0]?.visitors ?? 0);
  } catch {
    uniqueVisitors30d = 0;
  }

  const funnel = await getAdminTrafficFunnelPanel();

  const growthProjection = computePlatformGrowthProjection({
    activeClientSubscriptions: finances.activeSubscriptions,
    premiumTrainers: finances.premiumTrainers,
    clientsInFreeTrial: finances.clientsInFreeTrial,
    clientsWithCard: finances.clientsWithCard,
    revenue30dCents: revenue30d.revenueCents,
    grossProfit30dCents: revenue30d.grossProfitCents,
    uniqueVisitors30d,
    clientSignupPageViews7d: funnel.clientSignupPageViews,
    pendingClientRegistrations: funnel.pendingClientRegistrations.total,
    daysSinceLaunch: launchDays,
  });

  return {
    userCounts,
    stabilityScore: stability.score,
    stabilityNotes: stability.notes,
    securityScore: security.score,
    securityNotes: security.notes,
    lifetimeRevenueCents: lifetime.revenueCents,
    lifetimeGrossProfitCents: lifetime.grossProfitCents,
    successRating,
    valuation,
    potentialRating,
    growthProjection,
  };
}

export async function getReturningVisitorRatio30d(): Promise<number> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await prisma.$queryRaw<{ visitors: bigint; returning: bigint }[]>`
      WITH v AS (
        SELECT "visitorId", COUNT(*)::int AS visits
        FROM site_analytics_events
        WHERE kind = 'PAGE_VIEW' AND "createdAt" >= ${since}
        GROUP BY "visitorId"
      )
      SELECT COUNT(*)::bigint AS visitors, COUNT(*) FILTER (WHERE visits > 1)::bigint AS returning FROM v
    `;
    const visitors = Number(rows[0]?.visitors ?? 0);
    const returning = Number(rows[0]?.returning ?? 0);
    return visitors > 0 ? returning / visitors : 0;
  } catch {
    return 0;
  }
}
