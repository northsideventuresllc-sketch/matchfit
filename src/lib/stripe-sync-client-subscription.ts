import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";
import type Stripe from "stripe";

const GRACE_MS = 72 * 60 * 60 * 1000;

function activeStripeStatuses(status: string): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Updates local subscription flags from Stripe. When a paid subscription lapses,
 * starts a 72-hour grace window before dashboard access is restricted.
 */
export async function syncClientSubscriptionFromStripe(subscriptionId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  const sub = (await stripe.subscriptions.retrieve(subscriptionId)) as Stripe.Subscription & { status: string };
  const client = await prisma.client.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    select: { id: true, subscriptionGraceUntil: true },
  });
  if (!client) return;

  const ok = activeStripeStatuses(String(sub.status));
  const now = Date.now();
  const existingGrace = client.subscriptionGraceUntil;
  const graceUntil = ok
    ? null
    : existingGrace && existingGrace.getTime() > now
      ? existingGrace
      : new Date(now + GRACE_MS);

  await prisma.client.update({
    where: { id: client.id },
    data: {
      stripeSubscriptionActive: ok,
      subscriptionGraceUntil: graceUntil,
    },
  });
}
