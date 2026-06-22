import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  countLaunchLifetimeMembers,
  launchClientActiveAccountWhere,
  launchClientActiveVipWhere,
  launchClientFreePlanWhere,
  launchClientPlatformTrialCountWhere,
  launchClientSubscribedPlansWhere,
  launchTrainerCountWhere,
} from "@/lib/launch-account-counts";
import { adminPendingTrainerWhere } from "@/lib/admin-portal-list-filters";
import { isMissingClientPlanColumnError } from "@/lib/ensure-client-plan-schema";
import { isMissingClientPlatformTrialColumnError } from "@/lib/ensure-client-platform-trial-schema";
import { getHomeUserCounts } from "@/lib/home-user-counts";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";

/** Clients with no login (or profile update) activity within this window count as inactive. */
export const ADMIN_CLIENT_INACTIVITY_DAYS = 30;

export type AdminMemberOverviewPanel = {
  /** Cumulative clients + Fitness Pros ever on the platform (excludes test/QA; never decreases). */
  allMembersTotal: number;
  /** Complimentary card-free VIP trial at sign-up. */
  vipTrialClients: number;
  /** Active Free plan + Active VIP clients (excludes VIP trial). */
  subscribedClients: number;
  /** No recent site activity; Free and VIP subscribers still count as active. */
  inactiveClients: number;
  freePlanClients: number;
  activeVipClients: number;
  uniqueSiteVisitorsAllTime: number;
  pendingTrainers: number;
  compliantActiveTrainers: number;
  inactiveTrainers: number;
};

type CountRow = { n: bigint };

function n(row: CountRow | undefined): number {
  return Number(row?.n ?? BigInt(0));
}

function isRecoverableMemberOverviewClientError(e: unknown): boolean {
  return isMissingClientPlanColumnError(e) || isMissingClientPlatformTrialColumnError(e);
}

async function safeClientMetricCount(where: Prisma.ClientWhereInput, fallback = 0): Promise<number> {
  try {
    return await prisma.client.count({ where });
  } catch (e) {
    if (isRecoverableMemberOverviewClientError(e)) {
      console.warn("[admin member overview] client count fallback", e);
      return fallback;
    }
    throw e;
  }
}

/** Onboarded trainers without recent activity (inverse of home active trainers). */
async function countInactiveTrainers(): Promise<number> {
  const userCounts = await getHomeUserCounts();
  const onboarded = await prisma.trainer.count({
    where: {
      ...launchTrainerCountWhere(),
      profile: { is: { dashboardActivatedAt: { not: null } } },
    },
  });
  return Math.max(0, onboarded - userCounts.trainersActive);
}

/** All real members ever: launch-count clients + trainers (excludes test/QA; includes deactivated/deidentified). */
async function countAllMembersTotal(): Promise<number> {
  return countLaunchLifetimeMembers();
}

async function countUniqueSiteVisitorsAllTime(): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT "visitorId")::bigint AS n
      FROM site_analytics_events
      WHERE kind = 'PAGE_VIEW'
    `;
    return n(rows[0]);
  } catch (e) {
    if (isPrismaMissingTableError(e, "site_analytics_events")) return 0;
    throw e;
  }
}

export async function countInactiveLaunchClients(now = new Date()): Promise<number> {
  const threshold = new Date(now.getTime() - ADMIN_CLIENT_INACTIVITY_DAYS * 24 * 60 * 60 * 1000);
  return safeClientMetricCount({
    ...launchClientActiveAccountWhere(),
    updatedAt: { lt: threshold },
    NOT: launchClientSubscribedPlansWhere(now),
  });
}

export async function getAdminMemberOverviewPanel(now = new Date()): Promise<AdminMemberOverviewPanel> {
  const userCounts = await getHomeUserCounts();

  const [
    allMembersTotal,
    vipTrialClients,
    inactiveClients,
    freePlanClients,
    activeVipClients,
    uniqueSiteVisitorsAllTime,
    inactiveTrainers,
    pendingTrainers,
  ] = await Promise.all([
    countAllMembersTotal(),
    safeClientMetricCount(launchClientPlatformTrialCountWhere(now)),
    countInactiveLaunchClients(now),
    safeClientMetricCount(launchClientFreePlanWhere(now)),
    safeClientMetricCount(launchClientActiveVipWhere()),
    countUniqueSiteVisitorsAllTime(),
    countInactiveTrainers(),
    prisma.trainer.count({ where: adminPendingTrainerWhere() }),
  ]);

  const subscribedClients = freePlanClients + activeVipClients;

  return {
    allMembersTotal,
    vipTrialClients,
    subscribedClients,
    inactiveClients,
    freePlanClients,
    activeVipClients,
    uniqueSiteVisitorsAllTime,
    pendingTrainers,
    compliantActiveTrainers: userCounts.trainersActive,
    inactiveTrainers,
  };
}
