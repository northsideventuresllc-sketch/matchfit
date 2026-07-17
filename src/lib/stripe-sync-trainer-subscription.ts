import { prisma } from "@/lib/prisma";
import { getStripe, stripeObjectIsLiveBilling } from "@/lib/stripe-server";
import type Stripe from "stripe";

const GRACE_MS = 72 * 60 * 60 * 1000;

function activeStripeStatuses(status: string): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Updates local Independent Pro subscription flags from Stripe. When a paid
 * subscription lapses, starts a 72-hour grace window before dashboard access is restricted.
 */
export async function syncTrainerSubscriptionFromStripe(subscriptionId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  const sub = (await stripe.subscriptions.retrieve(subscriptionId)) as Stripe.Subscription & { status: string };
  const trainer = await prisma.trainer.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    select: { id: true, subscriptionGraceUntil: true },
  });
  if (!trainer) return;

  const ok = activeStripeStatuses(String(sub.status));
  const now = Date.now();
  const existingGrace = trainer.subscriptionGraceUntil;
  const graceUntil = ok
    ? null
    : existingGrace && existingGrace.getTime() > now
      ? existingGrace
      : new Date(now + GRACE_MS);

  await prisma.trainer.update({
    where: { id: trainer.id },
    data: {
      stripeSubscriptionActive: ok,
      subscriptionGraceUntil: graceUntil,
      ...(ok
        ? {
            accountDeactivatedAt: null,
            platformTrialConsumed: true,
          }
        : {}),
    },
  });

  if (ok) {
    await prisma.trainerProfile.updateMany({
      where: { trainerId: trainer.id, premiumStudioEnabledAt: null },
      data: { premiumStudioEnabledAt: new Date() },
    });
  }

  void stripeObjectIsLiveBilling(sub.livemode);
}

/**
 * Applies checkout session metadata after Independent Pro subscription checkout completes.
 */
export async function finalizeTrainerSubscriptionCheckout(args: {
  trainerId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
}): Promise<void> {
  const now = new Date();
  await prisma.trainer.update({
    where: { id: args.trainerId },
    data: {
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeSubscriptionActive: true,
      accountDeactivatedAt: null,
      paymentGraceUntil: null,
      subscriptionGraceUntil: null,
      platformTrialConsumed: true,
    },
  });
  await prisma.trainerProfile.updateMany({
    where: { trainerId: args.trainerId },
    data: { premiumStudioEnabledAt: now },
  });
}
