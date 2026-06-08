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

/** Trainers in onboarding (past signup, dashboard not fully live). */
function launchPendingTrainerWhere(): Prisma.TrainerWhereInput {
  return {
    ...launchTrainerCountWhere(),
    profile: {
      is: {
        hasSignedTOS: true,
        dashboardActivatedAt: null,
      },
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

async function countTotalActiveMembers(now = new Date()): Promise<number> {
  const [activeClients, userCounts, pendingTrainers] = await Promise.all([
    prisma.client.count({
      where: {
        ...launchClientCountWhere(),
        accountDeactivatedAt: null,
        NOT: launchClientInactiveSubscriberWhere(now),
      },
    }),
    getHomeUserCounts(),
    prisma.trainer.count({ where: launchPendingTrainerWhere() }),
  ]);

  return activeClients + userCounts.trainersActive + pendingTrainers;
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
    pendingTrainers,
    inactiveTrainers,
  ] = await Promise.all([
    countTotalActiveMembers(now),
    prisma.client.count({ where: launchClientFreeTrialCountWhere(now) }),
    countLaunchPlatformSubscribers(),
    prisma.client.count({ where: launchClientInactiveSubscriberWhere(now) }),
    countUniqueSiteVisitorsAllTime(),
    prisma.trainer.count({ where: launchPendingTrainerWhere() }),
    countInactiveTrainers(),
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
