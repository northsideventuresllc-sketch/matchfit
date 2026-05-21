import { prisma } from "@/lib/prisma";

/**
 * Persists the mapping from your app “seller” row to the Stripe Connect V2 account id (`acct_...`).
 * Production apps often attach this to `Trainer` / `User` instead of a demo table.
 */
export async function upsertConnectDemoSeller(input: {
  displayName: string;
  contactEmail: string;
  stripeAccountId: string;
}) {
  return prisma.stripeConnectDemoSeller.upsert({
    where: { stripeAccountId: input.stripeAccountId },
    create: {
      displayName: input.displayName,
      contactEmail: input.contactEmail,
      stripeAccountId: input.stripeAccountId,
    },
    update: {
      displayName: input.displayName,
      contactEmail: input.contactEmail,
    },
  });
}

export async function findConnectDemoSellerByAccountId(stripeAccountId: string) {
  return prisma.stripeConnectDemoSeller.findUnique({
    where: { stripeAccountId },
  });
}

export async function updateConnectDemoSellerSubscription(input: {
  stripeAccountId: string;
  subscriptionId: string | null;
  status: string | null;
}) {
  return prisma.stripeConnectDemoSeller.update({
    where: { stripeAccountId: input.stripeAccountId },
    data: {
      platformSubscriptionId: input.subscriptionId,
      platformSubscriptionStatus: input.status,
    },
  });
}
