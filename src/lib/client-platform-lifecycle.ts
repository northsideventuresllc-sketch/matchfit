import { addPaymentGraceDays } from "@/lib/client-platform-trial-constants";
import { prisma } from "@/lib/prisma";

export type ClientPlatformLifecycleSummary = {
  paymentGraceStarted: number;
  accountsDeactivated: number;
};

const platformBillingSelect = {
  id: true,
  stripeSubscriptionId: true,
  stripeSubscriptionActive: true,
  platformTrialEndsAt: true,
  paymentGraceUntil: true,
  accountDeactivatedAt: true,
  platformTrialConsumed: true,
} as const;

/** Advance trial → payment grace → deactivation for clients without an active Stripe subscription. */
export async function runClientPlatformBillingLifecycleJobs(): Promise<ClientPlatformLifecycleSummary> {
  const now = new Date();
  let paymentGraceStarted = 0;
  let accountsDeactivated = 0;

  const trialExpired = await prisma.client.findMany({
    where: {
      deidentifiedAt: null,
      accountDeactivatedAt: null,
      platformTrialEndsAt: { lte: now },
      paymentGraceUntil: null,
      stripeSubscriptionActive: false,
      OR: [{ stripeSubscriptionId: null }, { stripeSubscriptionId: "" }],
    },
    select: platformBillingSelect,
  });

  for (const client of trialExpired) {
    await prisma.client.update({
      where: { id: client.id },
      data: {
        paymentGraceUntil: addPaymentGraceDays(client.platformTrialEndsAt ?? now),
        platformTrialConsumed: true,
      },
    });
    paymentGraceStarted += 1;
  }

  const graceExpired = await prisma.client.findMany({
    where: {
      deidentifiedAt: null,
      accountDeactivatedAt: null,
      paymentGraceUntil: { lte: now },
      stripeSubscriptionActive: false,
    },
    select: platformBillingSelect,
  });

  for (const client of graceExpired) {
    await prisma.client.update({
      where: { id: client.id },
      data: {
        accountDeactivatedAt: now,
        stripeSubscriptionActive: false,
      },
    });
    accountsDeactivated += 1;
  }

  return { paymentGraceStarted, accountsDeactivated };
}

/** Lazy lifecycle sync for a single client on login or dashboard access. */
export async function syncClientPlatformBillingLifecycle(clientId: string): Promise<void> {
  const now = new Date();
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: platformBillingSelect,
  });
  if (!client || client.accountDeactivatedAt) return;
  if (client.stripeSubscriptionActive && client.stripeSubscriptionId?.trim()) return;

  if (
    client.platformTrialEndsAt &&
    client.platformTrialEndsAt.getTime() <= now.getTime() &&
    !client.paymentGraceUntil
  ) {
    await prisma.client.update({
      where: { id: client.id },
      data: {
        paymentGraceUntil: addPaymentGraceDays(client.platformTrialEndsAt),
        platformTrialConsumed: true,
      },
    });
    return;
  }

  if (client.paymentGraceUntil && client.paymentGraceUntil.getTime() <= now.getTime()) {
    await prisma.client.update({
      where: { id: client.id },
      data: {
        accountDeactivatedAt: now,
        stripeSubscriptionActive: false,
      },
    });
  }
}
