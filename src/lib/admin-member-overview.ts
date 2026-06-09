import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  countLaunchPlatformSubscribers,
  launchClientBillingGraceWhere,
  launchClientCountWhere,
  launchClientFreeTrialCountWhere,
  launchClientPlatformPaymentGraceWhere,
  launchTrainerCountWhere,
} from "@/lib/launch-account-counts";
import { adminPendingTrainerWhere } from "@/lib/admin-portal-list-filters";
import { getHomeUserCounts } from "@/lib/home-user-counts";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";

export type AdminMemberOverviewPanel = {
  totalActiveMembers: number;
  totalMembers: number;
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

async function countTotalActiveMembers(now = new Date(), userCounts?: Awaited<ReturnType<typeof getHomeUserCounts>>): Promise<number> {
  const counts = userCounts ?? (await getHomeUserCounts());
  const [activeClients, pendingTrainers] = await Promise.all([
    prisma.client.count({
      where: {
        ...launchClientCountWhere(),
        accountDeactivatedAt: null,
        NOT: launchClientInactiveSubscriberWhere(now),
      },
    }),
    prisma.trainer.count({ where: adminPendingTrainerWhere() }),
  ]);

  return activeClients + counts.trainersActive + pendingTrainers;
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
    totalActiveMembers,
    freeTrialClients,
    subscribedClients,
    inactiveClients,
    uniqueSiteVisitorsAllTime,
    inactiveTrainers,
    pendingTrainers,
  ] = await Promise.all([
    countTotalActiveMembers(now, userCounts),
    prisma.client.count({ where: launchClientFreeTrialCountWhere(now) }),
    countLaunchPlatformSubscribers(),
    prisma.client.count({ where: launchClientInactiveSubscriberWhere(now) }),
    countUniqueSiteVisitorsAllTime(),
    countInactiveTrainers(),
    prisma.trainer.count({ where: adminPendingTrainerWhere() }),
  ]);

  return {
    totalActiveMembers,
    totalMembers: userCounts.clientsTotal + userCounts.trainersTotal,
    freeTrialClients,
    subscribedClients,
    inactiveClients,
    uniqueSiteVisitorsAllTime,
    pendingTrainers,
    compliantActiveTrainers: userCounts.trainersActive,
    inactiveTrainers,
  };
}
