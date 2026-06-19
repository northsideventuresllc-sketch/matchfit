import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";

export const CLIENT_VIP_STRIPE_PRICE_ENV = process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID;

export async function createVipCheckoutSession(
  clientId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string } | { error: string }> {
  const priceId = CLIENT_VIP_STRIPE_PRICE_ENV?.trim();
  if (!priceId) {
    return { error: "VIP billing is not configured." };
  }
  const stripe = getStripe();
  if (!stripe) {
    return { error: "Billing is not configured." };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      clientId,
      purpose: "client_vip",
    },
    subscription_data: {
      metadata: {
        clientId,
        purpose: "client_vip",
      },
    },
  });

  if (!session.url) {
    return { error: "Stripe did not return a checkout URL." };
  }
  return { url: session.url };
}

export async function activateVipFromWebhook(subscriptionId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const clientId = String(sub.metadata?.clientId ?? "").trim();
  if (!clientId) return;

  await prisma.client.updateMany({
    where: { id: clientId },
    data: {
      clientPlanTier: "VIP",
      vipSubscriptionActive: true,
      vipSubscriptionId: subscriptionId,
      accountDeactivatedAt: null,
    },
  });
}

export async function deactivateVip(clientId: string): Promise<void> {
  await prisma.client.updateMany({
    where: { id: clientId },
    data: {
      clientPlanTier: "FREEMIUM",
      vipSubscriptionActive: false,
    },
  });
}

export async function deactivateVipBySubscriptionId(subscriptionId: string): Promise<void> {
  const client = await prisma.client.findFirst({
    where: { vipSubscriptionId: subscriptionId },
    select: { id: true },
  });
  if (client) {
    await deactivateVip(client.id);
  }
}
