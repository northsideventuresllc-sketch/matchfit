import { addPaymentGraceDays } from "@/lib/client-platform-trial-constants";
import { notifyClientPlatformPaymentGraceStarted } from "@/lib/client-membership-email-notify";
import { prisma } from "@/lib/prisma";

export type ClientPlatformLifecycleSummary = {
  paymentGraceStarted: number;
  accountsDeactivated: number;
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
} as const;

async function startPaymentGraceForClient(
  client: {
    id: string;
    email: string;
    platformTrialEndsAt: Date | null;
  },
  now: Date,
): Promise<void> {
  const paymentGraceUntil = addPaymentGraceDays(client.platformTrialEndsAt ?? now);
  await prisma.client.update({
    where: { id: client.id },
    data: {
      paymentGraceUntil,
      platformTrialConsumed: true,
    },
  });
  void notifyClientPlatformPaymentGraceStarted({
    clientId: client.id,
    email: client.email,
    paymentGraceUntilLabel: paymentGraceUntil.toLocaleDateString("en-US", { dateStyle: "long" }),
  });
}

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
    await startPaymentGraceForClient(client, now);
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
    await startPaymentGraceForClient(client, now);
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
