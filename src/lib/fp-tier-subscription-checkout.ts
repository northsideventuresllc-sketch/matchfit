import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";
import type { FpAccountTier } from "@/lib/fp-account-tier-types";
import {
  fpStripeSubscriptionPurposeForTier,
  fpStripePriceEnvKeyForTier,
} from "@/lib/fp-tier-billing";

export async function createFpTierCheckoutSession(
  trainerId: string,
  email: string,
  tier: FpAccountTier,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string; sessionId: string } | { error: string }> {
  const stripe = getStripe();
  const priceEnvKey = fpStripePriceEnvKeyForTier(tier);
  const purpose = fpStripeSubscriptionPurposeForTier(tier);
  if (!stripe || !priceEnvKey || !purpose) {
    return { error: "Paid tier billing is not configured for this account type." };
  }

  const priceId = process.env[priceEnvKey]?.trim();
  if (!priceId) {
    return { error: "Paid tier billing is not configured." };
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { stripeCustomerId: true, email: true },
  });
  if (!trainer) {
    return { error: "Account not found." };
  }

  let customerId = trainer.stripeCustomerId?.trim() || null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email.trim() || trainer.email,
      metadata: { trainerId },
    });
    customerId = customer.id;
    await prisma.trainer.update({
      where: { id: trainerId },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { trainerId, purpose, fpTier: tier },
    },
    metadata: { trainerId, purpose, fpTier: tier },
  });

  if (!session.url) {
    return { error: "Could not create checkout session." };
  }

  return { url: session.url, sessionId: session.id };
}

export async function activateFpTierSubscriptionFromWebhook(subscriptionId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const trainerId = sub.metadata?.trainerId?.trim();
  const fpTier = sub.metadata?.fpTier?.trim();
  if (!trainerId || !fpTier) return;

  await prisma.trainer.update({
    where: { id: trainerId },
    data: {
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionActive: sub.status === "active" || sub.status === "trialing",
    },
  });
}

export async function deactivateFpTierSubscription(trainerId: string): Promise<void> {
  await prisma.trainer.update({
    where: { id: trainerId },
    data: {
      stripeSubscriptionActive: false,
    },
  });
}
