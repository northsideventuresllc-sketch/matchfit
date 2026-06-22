import { prisma } from "@/lib/prisma";

export type ClientPlatformLifecycleSummary = {
  trialEndedToFree: number;
  accountsDeactivated: number;
  freemiumDowngrades: number;
};

const platformBillingSelect = {
  id: true,
  email: true,
  stripeSubscriptionId: true,
  stripeSubscriptionActive: true,
  platformTrialEndsAt: true,
  paymentGraceUntil: true,
  accountDeactivatedAt: true,
  platformTrialConsumed: true,
  vipSubscriptionActive: true,
  clientPlanTier: true,
} as const;

async function downgradeTrialToFreePlan(clientId: string): Promise<void> {
  await prisma.client.update({
    where: { id: clientId },
    data: {
      platformTrialConsumed: true,
      clientPlanTier: "FREEMIUM",
    },
  });
}

/** Advance trial → Free plan for clients without paid VIP or legacy Stripe subscription. */
export async function runClientPlatformBillingLifecycleJobs(): Promise<ClientPlatformLifecycleSummary> {
  const now = new Date();
  let trialEndedToFree = 0;
  let accountsDeactivated = 0;

  const trialExpired = await prisma.client.findMany({
    where: {
      deidentifiedAt: null,
      accountDeactivatedAt: null,
      platformTrialEndsAt: { lte: now },
      platformTrialConsumed: false,
      vipSubscriptionActive: false,
      stripeSubscriptionActive: false,
    },
    select: platformBillingSelect,
  });

  for (const client of trialExpired) {
    await downgradeTrialToFreePlan(client.id);
    trialEndedToFree += 1;
  }

  const graceExpired = await prisma.client.findMany({
    where: {
      deidentifiedAt: null,
      accountDeactivatedAt: null,
      paymentGraceUntil: { lte: now },
      stripeSubscriptionActive: false,
      vipSubscriptionActive: false,
    },
    select: platformBillingSelect,
  });

  for (const client of graceExpired) {
    await prisma.client.update({
      where: { id: client.id },
      data: {
        accountDeactivatedAt: now,
        stripeSubscriptionActive: false,
        clientPlanTier: "FREEMIUM",
        platformTrialConsumed: true,
      },
    });
    accountsDeactivated += 1;
  }

  const freemiumCandidates = await prisma.client.findMany({
    where: {
      deidentifiedAt: null,
      accountDeactivatedAt: null,
      platformTrialConsumed: true,
      stripeSubscriptionActive: false,
      vipSubscriptionActive: false,
      clientPlanTier: { not: "FREEMIUM" },
    },
    select: { id: true },
  });

  let freemiumDowngrades = 0;
  for (const client of freemiumCandidates) {
    await prisma.client.update({
      where: { id: client.id },
      data: { clientPlanTier: "FREEMIUM" },
    });
    freemiumDowngrades += 1;
  }

  return { trialEndedToFree, accountsDeactivated, freemiumDowngrades };
}

/** Lazy lifecycle sync for a single client on login or dashboard access. */
export async function syncClientPlatformBillingLifecycle(clientId: string): Promise<void> {
  const now = new Date();
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: platformBillingSelect,
  });
  if (!client || client.accountDeactivatedAt) return;
  if (client.vipSubscriptionActive) return;
  if (client.stripeSubscriptionActive && client.stripeSubscriptionId?.trim()) return;

  if (
    client.platformTrialEndsAt &&
    client.platformTrialEndsAt.getTime() <= now.getTime() &&
    !client.platformTrialConsumed
  ) {
    await downgradeTrialToFreePlan(client.id);
    return;
  }

  if (
    client.paymentGraceUntil &&
    client.paymentGraceUntil.getTime() <= now.getTime() &&
    !client.vipSubscriptionActive &&
    !client.stripeSubscriptionActive
  ) {
    await prisma.client.update({
      where: { id: client.id },
      data: {
        accountDeactivatedAt: now,
        stripeSubscriptionActive: false,
        clientPlanTier: "FREEMIUM",
        platformTrialConsumed: true,
      },
    });
  }
}
