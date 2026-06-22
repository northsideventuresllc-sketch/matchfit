import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  buildAdminPortalClientSqlFilter,
  buildAdminPortalClientSqlFilterLegacy,
  buildAdminPortalTrainerSqlFilter,
  buildAdminPortalTrainerSqlFilterLegacy,
  redactEmailForAdminPortal,
} from "@/lib/admin-portal-list-filters";
import { filterOwnerTestIdentities } from "@/lib/owner-test-account-exclusion";
import type {
  AdminFeaturedSnapshot,
  AdminPortalOverview,
  AdminRevenueSnapshot,
  AdminSignupRow,
  AdminUserStats,
} from "@/lib/admin-portal-types";
import { ensureAdminReportingSchema } from "@/lib/ensure-admin-reporting-schema";
import { ensureClientPlanSchema, isMissingClientPlanColumnError } from "@/lib/ensure-client-plan-schema";
import { ensureClientPlatformTrialSchema } from "@/lib/ensure-client-platform-trial-schema";
import { ensureTrainerRegisterSchema } from "@/lib/ensure-trainer-register-schema";
import { prisma } from "@/lib/prisma";
import { formatFeaturedDisplayDayLabel } from "@/lib/featured-eastern-calendar";
import { getHomeUserCounts } from "@/lib/home-user-counts";
import { getPlatformRevenueTotals } from "@/lib/platform-revenue-events";
import { scrubNonLivePlatformRevenueEvents } from "@/lib/platform-revenue-filters";
import { getAdminMemberOverviewPanel } from "@/lib/admin-member-overview";
import {
  getAdminAlertsPanel,
  getAdminClientPipelinePanel,
  getAdminEmailStatsPanel,
  getAdminFinancesPanel,
  getAdminPlatformSummaryPanel,
  getAdminPremiumTrainerActivityPanel,
  getAdminSiteActivityPanel,
  getAdminTrainerPipelinePanel,
} from "@/lib/admin-portal-metrics";
import { getAdPerformancePanel } from "@/lib/ad-platform-performance";
import { getAdminBackgroundChecksPanel } from "@/lib/admin-background-checks-panel";
import { getAdminSiteTrafficSnapshot } from "@/lib/site-analytics";

export type {
  AdminFeaturedSnapshot,
  AdminPortalOverview,
  AdminRevenueSnapshot,
  AdminSignupRow,
  AdminTrafficSnapshot,
  AdminUserStats,
} from "@/lib/admin-portal-types";
export { formatUsdFromCents } from "@/lib/admin-portal-types";

type SignupUnionRow = {
  kind: "client" | "trainer";
  id: string;
  username: string;
  email: string;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: Date;
};

const CLIENT_SIGNUP_FILTER = buildAdminPortalClientSqlFilter();
const TRAINER_SIGNUP_FILTER = buildAdminPortalTrainerSqlFilter();
const CLIENT_SIGNUP_FILTER_LEGACY = buildAdminPortalClientSqlFilterLegacy();
const TRAINER_SIGNUP_FILTER_LEGACY = buildAdminPortalTrainerSqlFilterLegacy();

function displayNameFromParts(row: SignupUnionRow): string {
  const preferred = row.preferred_name?.trim();
  if (preferred) return preferred;
  if (row.kind === "trainer") {
    const full = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
    if (full) return full;
  }
  return row.username;
}

async function fetchSignupUnionRows(opts: { limit: number; offset: number }): Promise<SignupUnionRow[]> {
  return prisma.$queryRaw<SignupUnionRow[]>`
    SELECT kind, id, username, email, preferred_name, first_name, last_name, created_at
    FROM (
      SELECT
        'client'::text AS kind,
        c.id,
        c.username,
        c.email,
        c."preferredName" AS preferred_name,
        NULL::text AS first_name,
        NULL::text AS last_name,
        c."createdAt" AS created_at
      FROM clients c
      WHERE c."deidentifiedAt" IS NULL
        ${CLIENT_SIGNUP_FILTER}
      UNION ALL
      SELECT
        'trainer'::text,
        t.id,
        t.username,
        t.email,
        t."preferredName",
        t."firstName",
        t."lastName",
        t."createdAt"
      FROM trainers t
      WHERE t."deidentifiedAt" IS NULL
        ${TRAINER_SIGNUP_FILTER}
    ) combined
    ORDER BY created_at DESC
    LIMIT ${opts.limit}
    OFFSET ${opts.offset}
  `;
}

async function countSignupUnionTotal(): Promise<number> {
  const rows = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::bigint AS total
    FROM (
      SELECT c.id FROM clients c WHERE c."deidentifiedAt" IS NULL ${CLIENT_SIGNUP_FILTER}
      UNION ALL
      SELECT t.id FROM trainers t WHERE t."deidentifiedAt" IS NULL ${TRAINER_SIGNUP_FILTER}
    ) combined
  `;
  return Number(rows[0]?.total ?? 0);
}

async function loadStatsForSignups(rows: SignupUnionRow[]): Promise<Map<string, AdminUserStats>> {
  const out = new Map<string, AdminUserStats>();
  if (rows.length === 0) return out;

  const clientIds = rows.filter((r) => r.kind === "client").map((r) => r.id);
  const trainerIds = rows.filter((r) => r.kind === "trainer").map((r) => r.id);

  const [clients, trainers, clientTx, trainerTx] = await Promise.all([
    clientIds.length
      ? prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: {
            id: true,
            stripeSubscriptionActive: true,
            safetySuspended: true,
          },
        })
      : [],
    trainerIds.length
      ? prisma.trainer.findMany({
          where: { id: { in: trainerIds } },
          select: {
            id: true,
            safetySuspended: true,
            profile: {
              select: {
                dashboardActivatedAt: true,
                backgroundCheckStatus: true,
                premiumStudioEnabledAt: true,
              },
            },
          },
        })
      : [],
    clientIds.length
      ? prisma.trainerClientServiceTransaction.groupBy({
          by: ["clientId"],
          where: { clientId: { in: clientIds } },
          _count: { _all: true },
          _sum: { totalChargedCents: true, amountCents: true },
        })
      : [],
    trainerIds.length
      ? prisma.trainerClientServiceTransaction.groupBy({
          by: ["trainerId"],
          where: { trainerId: { in: trainerIds } },
          _count: { _all: true },
          _sum: { amountCents: true },
        })
      : [],
  ]);

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const trainerById = new Map(trainers.map((t) => [t.id, t]));
  const clientTxById = new Map(clientTx.map((g) => [g.clientId, g]));
  const trainerTxById = new Map(trainerTx.map((g) => [g.trainerId, g]));

  for (const row of rows) {
    const key = `${row.kind}:${row.id}`;
    if (row.kind === "client") {
      const c = clientById.get(row.id);
      const tx = clientTxById.get(row.id);
      const gross = Number(tx?._sum.totalChargedCents ?? tx?._sum.amountCents ?? 0);
      out.set(key, {
        completedPurchases: tx?._count._all ?? 0,
        grossVolumeCents: gross,
        subscriptionActive: c?.stripeSubscriptionActive ?? false,
        dashboardActivated: null,
        backgroundCheckStatus: null,
        premiumStudio: null,
        safetySuspended: c?.safetySuspended ?? false,
      });
    } else {
      const t = trainerById.get(row.id);
      const tx = trainerTxById.get(row.id);
      const profile = t?.profile;
      out.set(key, {
        completedPurchases: tx?._count._all ?? 0,
        grossVolumeCents: Number(tx?._sum.amountCents ?? 0),
        subscriptionActive: null,
        dashboardActivated: Boolean(profile?.dashboardActivatedAt),
        backgroundCheckStatus: profile?.backgroundCheckStatus ?? null,
        premiumStudio: Boolean(profile?.premiumStudioEnabledAt),
        safetySuspended: t?.safetySuspended ?? false,
      });
    }
  }

  return out;
}

function unionRowsToSignupRows(rows: SignupUnionRow[], stats: Map<string, AdminUserStats>): AdminSignupRow[] {
  return rows.map((row) => {
    const key = `${row.kind}:${row.id}`;
    return {
      kind: row.kind,
      id: row.id,
      username: row.username,
      email: redactEmailForAdminPortal(row.email, row.username, row.kind),
      displayName: displayNameFromParts(row),
      createdAt: row.created_at.toISOString(),
      stats: stats.get(key) ?? {
        completedPurchases: 0,
        grossVolumeCents: 0,
        subscriptionActive: null,
        dashboardActivated: null,
        backgroundCheckStatus: null,
        premiumStudio: null,
        safetySuspended: false,
      },
    };
  });
}

export async function getAdminSignupLog(opts: {
  limit?: number;
  offset?: number;
}): Promise<{ rows: AdminSignupRow[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  try {
    const [unionRows, total] = await Promise.all([
      fetchSignupUnionRows({ limit, offset }),
      countSignupUnionTotal(),
    ]);
    const stats = await loadStatsForSignups(unionRows);
    const visibleRows = filterOwnerTestIdentities(unionRows, (row) => ({
      username: row.username,
      email: row.email,
      role: row.kind,
    }));
    return { rows: unionRowsToSignupRows(visibleRows, stats), total };
  } catch (e) {
    if (!isMissingInternalQaSyntheticPersonaColumn(e)) throw e;
    return getAdminSignupLogWithoutSyntheticFilter({ limit, offset });
  }
}

async function getAdminSignupLogWithoutSyntheticFilter(opts: {
  limit: number;
  offset: number;
}): Promise<{ rows: AdminSignupRow[]; total: number }> {
  const unionRows = await prisma.$queryRaw<SignupUnionRow[]>`
    SELECT kind, id, username, email, preferred_name, first_name, last_name, created_at
    FROM (
      SELECT 'client'::text AS kind, c.id, c.username, c.email, c."preferredName" AS preferred_name,
        NULL::text AS first_name, NULL::text AS last_name, c."createdAt" AS created_at
      FROM clients c WHERE c."deidentifiedAt" IS NULL ${CLIENT_SIGNUP_FILTER_LEGACY}
      UNION ALL
      SELECT 'trainer'::text, t.id, t.username, t.email, t."preferredName", t."firstName", t."lastName", t."createdAt"
      FROM trainers t WHERE t."deidentifiedAt" IS NULL ${TRAINER_SIGNUP_FILTER_LEGACY}
    ) combined
    ORDER BY created_at DESC
    LIMIT ${opts.limit}
    OFFSET ${opts.offset}
  `;
  const totalRows = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::bigint AS total FROM (
      SELECT c.id FROM clients c WHERE c."deidentifiedAt" IS NULL ${CLIENT_SIGNUP_FILTER_LEGACY}
      UNION ALL
      SELECT t.id FROM trainers t WHERE t."deidentifiedAt" IS NULL ${TRAINER_SIGNUP_FILTER_LEGACY}
    ) combined
  `;
  const stats = await loadStatsForSignups(unionRows);
  return {
    rows: unionRowsToSignupRows(unionRows, stats),
    total: Number(totalRows[0]?.total ?? 0),
  };
}

function isMissingInternalQaSyntheticPersonaColumn(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const m = e.message;
  return m.includes("internalQaSyntheticPersona") && (m.includes("42703") || m.includes("does not exist"));
}

export async function getAdminRevenueSnapshot(): Promise<AdminRevenueSnapshot> {
  const totals = await getPlatformRevenueTotals();
  return {
    revenueCents: totals.revenueCents,
    grossProfitCents: totals.grossProfitCents,
    eventCount: totals.eventCount,
    byCategory: totals.byCategory,
    activePlatformSubscribers: totals.activeClientSubscribers,
    activeTrainerPremiumSubscribers: totals.activeTrainerPremiumSubscribers,
  };
}

export async function getAdminRecentFeatured(limit = 6): Promise<AdminFeaturedSnapshot[]> {
  const allocations = await prisma.featuredDailyAllocation.findMany({
    orderBy: [{ displayDayKey: "desc" }, { sortOrder: "asc" }],
    take: limit,
    select: {
      displayDayKey: true,
      regionZipPrefix: true,
      source: true,
      trainerId: true,
      trainer: {
        select: {
          username: true,
          preferredName: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return allocations.map((a) => {
    const t = a.trainer;
    const displayName =
      t.preferredName?.trim() ||
      [t.firstName, t.lastName].filter(Boolean).join(" ").trim() ||
      t.username;
    return {
      displayDayKey: a.displayDayKey,
      displayDayLabel: formatFeaturedDisplayDayLabel(a.displayDayKey),
      regionZipPrefix: a.regionZipPrefix,
      source: a.source as "PAID_BID" | "RAFFLE",
      trainerId: a.trainerId,
      username: t.username,
      displayName,
    };
  });
}

export type AdminAuditLogRow = {
  id: string;
  action: string;
  targetRole: string;
  targetId: string;
  targetUsername: string | null;
  administratorEmail: string;
  createdAt: string;
};

export async function getAdminAuditLog(limit = 25): Promise<AdminAuditLogRow[]> {
  const rows = await prisma.administratorAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      targetRole: true,
      targetId: true,
      targetUsername: true,
      createdAt: true,
      administrator: { select: { email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetRole: row.targetRole,
    targetId: row.targetId,
    targetUsername: row.targetUsername,
    administratorEmail: row.administrator.email,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getAdminPortalOverview(): Promise<AdminPortalOverview> {
  try {
    await ensureAdminReportingSchema();
  } catch (e) {
    console.error("[admin portal] ensureAdminReportingSchema", e);
  }

  await Promise.all([
    ensureClientPlatformTrialSchema().catch((e) => {
      console.error("[admin portal] ensureClientPlatformTrialSchema", e);
    }),
    ensureClientPlanSchema().catch((e) => {
      console.error("[admin portal] ensureClientPlanSchema", e);
    }),
    ensureTrainerRegisterSchema().catch((e) => {
      console.error("[admin portal] ensureTrainerRegisterSchema", e);
    }),
  ]);

  await scrubNonLivePlatformRevenueEvents().catch((e) => {
    console.error("[admin portal] scrubNonLivePlatformRevenueEvents", e);
  });

  const [
    traffic,
    userCounts,
    memberOverview,
    revenue,
    recentFeatured,
    siteActivity,
    adPerformance,
    clientPipeline,
    pipeline,
    premiumActivity,
    finances,
    emailStats,
    alerts,
    platformSummary,
    backgroundChecks,
  ] = await Promise.all([
    getAdminSiteTrafficSnapshot(7),
    getHomeUserCounts(),
    getAdminMemberOverviewPanel(),
    getAdminRevenueSnapshot(),
    getAdminRecentFeatured(6),
    getAdminSiteActivityPanel(),
    getAdPerformancePanel(7),
    getAdminClientPipelinePanel(),
    getAdminTrainerPipelinePanel(),
    getAdminPremiumTrainerActivityPanel(),
    getAdminFinancesPanel(),
    getAdminEmailStatsPanel(7),
    getAdminAlertsPanel(),
    getAdminPlatformSummaryPanel(),
    getAdminBackgroundChecksPanel(),
  ]);

  return {
    computedAt: new Date().toISOString(),
    traffic,
    userCounts,
    memberOverview,
    revenue,
    recentFeatured,
    siteActivity,
    adPerformance,
    clientPipeline,
    pipeline,
    premiumActivity,
    finances,
    emailStats,
    alerts,
    platformSummary,
    backgroundChecks,
  };
}
