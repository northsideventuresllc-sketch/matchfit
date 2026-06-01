import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { launchClientCountWhere, launchTrainerCountWhere } from "@/lib/launch-account-counts";
import { prisma } from "@/lib/prisma";

/** Base filter for admin-facing platform revenue metrics (live Stripe billing only). */
export const LIVE_PLATFORM_REVENUE_WHERE: Prisma.PlatformRevenueEventWhereInput = {
  billingLiveMode: true,
};

export async function getExcludedRevenueAccountIds(): Promise<{
  clientIds: string[];
  trainerIds: string[];
}> {
  const [excludedClients, sandboxBillingClients, excludedTrainers] = await Promise.all([
    prisma.client.findMany({
      where: { NOT: launchClientCountWhere() },
      select: { id: true },
      take: 5000,
    }),
    prisma.client.findMany({
      where: { stripeBillingLiveMode: false },
      select: { id: true },
      take: 5000,
    }),
    prisma.trainer.findMany({
      where: { NOT: launchTrainerCountWhere() },
      select: { id: true },
      take: 5000,
    }),
  ]);

  const clientIds = new Set<string>([
    ...excludedClients.map((c) => c.id),
    ...sandboxBillingClients.map((c) => c.id),
  ]);

  return {
    clientIds: [...clientIds],
    trainerIds: excludedTrainers.map((t) => t.id),
  };
}

/**
 * Marks revenue ledger rows from test/QA accounts or sandbox billing as non-live.
 * Safe to run repeatedly (idempotent).
 */
export async function scrubNonLivePlatformRevenueEvents(): Promise<number> {
  const { clientIds, trainerIds } = await getExcludedRevenueAccountIds();
  const or: Prisma.PlatformRevenueEventWhereInput[] = [];
  if (clientIds.length > 0) or.push({ clientId: { in: clientIds } });
  if (trainerIds.length > 0) or.push({ trainerId: { in: trainerIds } });
  if (or.length === 0) return 0;

  const result = await prisma.platformRevenueEvent.updateMany({
    where: { billingLiveMode: true, OR: or },
    data: { billingLiveMode: false },
  });
  return result.count;
}

export function mergeLiveRevenueWhere(
  extra?: Prisma.PlatformRevenueEventWhereInput,
): Prisma.PlatformRevenueEventWhereInput {
  if (!extra) return { ...LIVE_PLATFORM_REVENUE_WHERE };
  return { AND: [LIVE_PLATFORM_REVENUE_WHERE, extra] };
}
