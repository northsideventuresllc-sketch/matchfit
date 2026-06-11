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
  buildAdminPortalTrainerDirectorySqlFilter,
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

  const trainerMetricsFilter = buildAdminPortalTrainerDirectorySqlFilter();
  const baseWhere = Prisma.sql`TRUE ${trainerMetricsFilter}`;

  const ownerTestTrainerSignupWhere = ownerTestExcludedSignupProgressWhere("trainer");

  const [startedSignup, basicInfoNoTos, signupCompleted, bgSubmitted, bgFailed, bgPassed, docsPending, live, pendingTrainerRows] =
    await Promise.all([
    prisma.signupFormProgress
      .count({ where: { role: "trainer", stage: "started_signup", ...ownerTestTrainerSignupWhere } })
      .catch(() => 0),
    prisma.signupFormProgress
      .count({ where: { role: "trainer", stage: "basic_info_complete", ...ownerTestTrainerSignupWhere } })
      .catch(() => 0),
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS n FROM trainers t
      LEFT JOIN trainer_profiles p ON p."trainerId" = t.id
      WHERE ${baseWhere}
        AND (p."dashboardActivatedAt" IS NULL OR p."trainerId" IS NULL)
        AND (
          p."hasSignedTOS" = true
          OR t."termsAcceptedAt" IS NOT NULL
          OR p."complianceWindowStartedAt" IS NOT NULL
          OR p."limitedDashboardUnlockedAt" IS NOT NULL
          OR p."registrationFeeHoldStatus" IN ('HELD', 'CAPTURED')
        )
    `,
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

  const totalInPipeline = n(signupCompleted[0]);
  const pct = (count: number) => (totalInPipeline > 0 ? Math.round((count / totalInPipeline) * 1000) / 10 : 0);

  const stages: AdminTrainerPipelineStage[] = [
    { id: "started_signup", label: "Started Sign Up", count: startedSignup, percentOfSignup: pct(startedSignup) },
    {
      id: "basic_info_no_tos",
      label: "Basic Info Complete, ToS Not Signed",
      count: basicInfoNoTos,
      percentOfSignup: pct(basicInfoNoTos),
    },
    { id: "signup", label: "Pending Trainers (Onboarding)", count: n(signupCompleted[0]), percentOfSignup: pct(n(signupCompleted[0])) },
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

async function loadAlertGroup(
  id: string,
  label: string,
  severity: AdminAlertSeverity,
  items: AdminAlertItem[],
  total: number,
): Promise<AdminAlertGroup> {
  return { id, label, severity, items, total };
}

export async function getAdminAlertsPanel(): Promise<AdminAlertsPanel> {
  const limit = 8;

  const [
    failedBgTrainers,
    bugReports,
    productIdeas,
    failedPayments,
    suspendedClients,
    suspendedTrainers,
    openSafetyReports,
    pendingChatReviews,
    chatContactWarnings,
    openDisputes,
  ] = await Promise.all([
    prisma.trainer.findMany({
      where: {
        ...launchTrainerCountWhere(),
        profile: {
          is: {
            OR: [
              { backgroundCheckStatus: { in: ["DENIED", "NEEDS_FURTHER_REVIEW"] } },
              { backgroundCheckReviewStatus: { in: ["DENIED", "NEEDS_FURTHER_REVIEW", "REJECTED"] } },
            ],
          },
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, username: true, preferredName: true, firstName: true, lastName: true, profile: { select: { backgroundCheckStatus: true } } },
    }),
    prisma.clientBugReport.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: { id: true, createdAt: true, category: true, description: true } }),
    prisma.productIdeaSubmission.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: { id: true, createdAt: true, category: true, description: true } }),
    prisma.client.findMany({
      where: launchClientBillingGraceWhere(new Date()),
      take: limit,
      orderBy: { subscriptionGraceUntil: "asc" },
      select: { id: true, username: true, subscriptionGraceUntil: true },
    }),
    prisma.client.count({ where: { safetySuspended: true, ...launchClientCountWhere() } }),
    prisma.trainer.count({ where: { safetySuspended: true, ...launchTrainerCountWhere() } }),
    prisma.safetyReport.count({ where: { status: "PENDING" } }),
    prisma.chatAdminReviewItem.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, createdAt: true, matchedSignalsJson: true, bodyExcerpt: true },
    }),
    prisma.chatAdminReviewItem.findMany({
      where: {
        status: "PENDING",
        OR: [
          { matchedSignalsJson: { contains: "phone" } },
          { matchedSignalsJson: { contains: "email" } },
          { matchedSignalsJson: { contains: "PHONE" } },
          { matchedSignalsJson: { contains: "EMAIL" } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, bodyExcerpt: true },
    }),
    prisma.sessionPayoutDispute.count({ where: { status: "PENDING_ADMIN" } }),
  ]);

  const failedBgItems: AdminAlertItem[] = failedBgTrainers.map((t) => ({
    id: t.id,
    severity: "critical" as const,
    title: `@${t.username}`,
    detail: `Background check: ${t.profile?.backgroundCheckStatus ?? "unknown"}`,
    href: `/admin`,
    createdAt: null,
  }));

  const groups: AdminAlertGroup[] = [
    await loadAlertGroup(
      "failed_bg",
      "Failed Background Checks",
      severityFromCount(failedBgTrainers.length, 3, 1),
      failedBgItems,
      failedBgTrainers.length,
    ),
    await loadAlertGroup(
      "bug_reports",
      "Bug Reports",
      severityFromCount(bugReports.length, 10, 3),
      bugReports.map((b) => ({
        id: b.id,
        severity: "warning" as const,
        title: b.category,
        detail: b.description.slice(0, 120),
        href: null,
        createdAt: b.createdAt.toISOString(),
      })),
      bugReports.length,
    ),
    await loadAlertGroup(
      "product_ideas",
      "Product Ideas",
      "info",
      productIdeas.map((p) => ({
        id: p.id,
        severity: "info" as const,
        title: p.category,
        detail: p.description.slice(0, 120),
        href: null,
        createdAt: p.createdAt.toISOString(),
      })),
      productIdeas.length,
    ),
    await loadAlertGroup(
      "failed_payments",
      "Failed Payments (Grace)",
      severityFromCount(failedPayments.length, 5, 1),
      failedPayments.map((c) => ({
        id: c.id,
        severity: "critical" as const,
        title: `@${c.username}`,
        detail: `Grace until ${c.subscriptionGraceUntil?.toISOString() ?? "unknown"}`,
        href: `/admin`,
        createdAt: c.subscriptionGraceUntil?.toISOString() ?? null,
      })),
      failedPayments.length,
    ),
    await loadAlertGroup(
      "flagged_users",
      "Flagged Users & Safety",
      severityFromCount(suspendedClients + suspendedTrainers + openSafetyReports, 5, 1),
      [
        ...(suspendedClients > 0
          ? [{ id: "clients-suspended", severity: "warning" as const, title: "Suspended clients", detail: `${suspendedClients} client(s) on safety hold`, href: "/admin", createdAt: null }]
          : []),
        ...(suspendedTrainers > 0
          ? [{ id: "trainers-suspended", severity: "warning" as const, title: "Suspended trainers", detail: `${suspendedTrainers} trainer(s) on safety hold`, href: "/admin", createdAt: null }]
          : []),
        ...(openSafetyReports > 0
          ? [{ id: "safety-open", severity: "warning" as const, title: "Open safety reports", detail: `${openSafetyReports} pending review`, href: "/admin", createdAt: null }]
          : []),
      ],
      suspendedClients + suspendedTrainers + openSafetyReports,
    ),
    await loadAlertGroup(
      "chat_warnings",
      "Chat Warnings (PII / Contact Leakage)",
      severityFromCount(chatContactWarnings.length, 3, 1),
      chatContactWarnings.map((c) => ({
        id: c.id,
        severity: "warning" as const,
        title: "Contact signal detected",
        detail: c.bodyExcerpt.slice(0, 100),
        href: null,
        createdAt: c.createdAt.toISOString(),
      })),
      pendingChatReviews.length,
    ),
    await loadAlertGroup(
      "security",
      "Security & Compliance",
      RLS_ADVISORY_TABLE_COUNT > 0 || openDisputes > 3 ? "warning" : "info",
      [
        ...(RLS_ADVISORY_TABLE_COUNT > 0
          ? [{ id: "rls-advisory", severity: "warning" as const, title: "RLS advisory", detail: `${RLS_ADVISORY_TABLE_COUNT} Supabase tables flagged (internal)`, href: null, createdAt: null }]
          : []),
        ...(openDisputes > 0
          ? [{ id: "disputes", severity: "info" as const, title: "Open payout disputes", detail: `${openDisputes} awaiting admin`, href: null, createdAt: null }]
          : []),
      ],
      RLS_ADVISORY_TABLE_COUNT + openDisputes,
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
