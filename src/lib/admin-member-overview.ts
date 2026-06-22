import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  countLaunchClients,
  countLaunchTrainers,
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
  /** Non-test clients + trainers with Terms accepted; excludes deidentified accounts. */
  allMembersTotal: number;
  /** Complimentary card-free VIP trial at sign-up. */
  vipTrialClients: number;
  /** Active clients on Free or VIP plans (excludes VIP trial). */
  subscribedClients: number;
  /** Launch clients inactive for {@link ADMIN_CLIENT_INACTIVITY_DAYS}+ days. */
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

/** All real members: launch-count clients + trainers (excludes test/QA and deidentified rows). */
async function countAllMembersTotal(): Promise<number> {
  const [clients, trainers] = await Promise.all([countLaunchClients(), countLaunchTrainers()]);
  return clients + trainers;
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
  });
}

export async function getAdminMemberOverviewPanel(now = new Date()): Promise<AdminMemberOverviewPanel> {
  const userCounts = await getHomeUserCounts();

  const [
    allMembersTotal,
    vipTrialClients,
    subscribedClients,
    inactiveClients,
    freePlanClients,
    activeVipClients,
    uniqueSiteVisitorsAllTime,
    inactiveTrainers,
    pendingTrainers,
  ] = await Promise.all([
    countAllMembersTotal(),
    safeClientMetricCount(launchClientPlatformTrialCountWhere(now)),
    safeClientMetricCount(launchClientSubscribedPlansWhere(now)),
    countInactiveLaunchClients(now),
    safeClientMetricCount(launchClientFreePlanWhere(now)),
    safeClientMetricCount(launchClientActiveVipWhere()),
    countUniqueSiteVisitorsAllTime(),
    countInactiveTrainers(),
    prisma.trainer.count({ where: adminPendingTrainerWhere() }),
  ]);

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
