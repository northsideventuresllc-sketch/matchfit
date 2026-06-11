import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  countLaunchClients,
  countLaunchPlatformSubscribers,
  countLaunchTrainers,
  launchClientBillingGraceWhere,
  launchClientCountWhere,
  launchClientFreeTrialCountWhere,
  launchClientPlatformPaymentGraceWhere,
  launchPendingTrainerWhere,
  launchTrainerCountWhere,
} from "@/lib/launch-account-counts";
import { getHomeUserCounts } from "@/lib/home-user-counts";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";

export type AdminMemberOverviewPanel = {
  /** Non-test clients + trainers with Terms accepted; excludes deidentified accounts. */
  allMembersTotal: number;
  freeTrialClients: number;
  subscribedClients: number;
  inactiveClients: number;
  uniqueSiteVisitorsAllTime: number;
  pendingTrainers: number;
  compliantActiveTrainers: number;
  inactiveTrainers: number;
};

type CountRow = { n: bigint };

function n(row: CountRow | undefined): number {
  return Number(row?.n ?? BigInt(0));
}

/** Clients who subscribed but are outside billing grace and not in trial. */
function launchClientInactiveSubscriberWhere(now = new Date()): Prisma.ClientWhereInput {
  return {
    ...launchClientCountWhere(),
    accountDeactivatedAt: null,
    OR: [
      { stripeLastSubscriptionInvoicePaidAt: { not: null } },
      { AND: [{ stripeSubscriptionId: { not: null } }, { stripeSubscriptionId: { not: "" } }] },
    ],
    stripeSubscriptionActive: false,
    NOT: {
      OR: [
        launchClientFreeTrialCountWhere(now),
        launchClientPlatformPaymentGraceWhere(now),
        launchClientBillingGraceWhere(now),
      ],
    },
  };
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

export async function getAdminMemberOverviewPanel(now = new Date()): Promise<AdminMemberOverviewPanel> {
  const userCounts = await getHomeUserCounts();

  const [
    allMembersTotal,
    freeTrialClients,
    subscribedClients,
    inactiveClients,
    uniqueSiteVisitorsAllTime,
    inactiveTrainers,
    pendingTrainers,
  ] = await Promise.all([
    countAllMembersTotal(),
    prisma.client.count({ where: launchClientFreeTrialCountWhere(now) }),
    countLaunchPlatformSubscribers(),
    prisma.client.count({ where: launchClientInactiveSubscriberWhere(now) }),
    countUniqueSiteVisitorsAllTime(),
    countInactiveTrainers(),
    prisma.trainer.count({ where: launchPendingTrainerWhere() }),
  ]);

  return {
    allMembersTotal,
    freeTrialClients,
    subscribedClients,
    inactiveClients,
    uniqueSiteVisitorsAllTime,
    pendingTrainers,
    compliantActiveTrainers: userCounts.trainersActive,
    inactiveTrainers,
  };
}
