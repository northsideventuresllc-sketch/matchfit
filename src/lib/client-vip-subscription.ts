import { prisma } from "@/lib/prisma";
import { getStripe, stripeObjectIsLiveBilling } from "@/lib/stripe-server";

export const CLIENT_VIP_STRIPE_PRICE_ENV = process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID;

export async function createVipCheckoutSession(
  clientId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string; sessionId: string } | { error: string }> {
  const stripe = getStripe();
  const priceId = CLIENT_VIP_STRIPE_PRICE_ENV?.trim();
  if (!stripe || !priceId) {
    return { error: "VIP billing is not configured." };
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { stripeCustomerId: true, email: true },
  });
  if (!client) {
    return { error: "Account not found." };
  }

  let customerId = client.stripeCustomerId?.trim() || null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email.trim() || client.email,
      metadata: { clientId },
    });
    customerId = customer.id;
    await prisma.client.update({
      where: { id: clientId },
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
      metadata: { clientId, purpose: "client_vip" },
    },
    metadata: { clientId, purpose: "client_vip" },
  });

  if (!session.url) {
    return { error: "Could not create checkout session." };
  }

  return { url: session.url, sessionId: session.id };
}

export async function activateVipFromWebhook(subscriptionId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const clientId = sub.metadata?.clientId?.trim();
  if (!clientId) return;

  await prisma.client.updateMany({
    where: { id: clientId },
    data: {
      clientPlanTier: "VIP",
      vipSubscriptionActive: true,
      vipSubscriptionId: subscriptionId,
      stripeBillingLiveMode: stripeObjectIsLiveBilling(sub.livemode),
    },
  });
}

export async function deactivateVip(clientId: string): Promise<void> {
  await prisma.client.update({
    where: { id: clientId },
    data: {
      clientPlanTier: "FREEMIUM",
      vipSubscriptionActive: false,
    },
  });
}

export async function resolveClientIdFromVipSubscription(
  sub: { id: string; metadata?: Record<string, string> | null },
): Promise<string | null> {
  const fromMeta = sub.metadata?.clientId?.trim();
  if (fromMeta) return fromMeta;

  const client = await prisma.client.findFirst({
    where: { vipSubscriptionId: sub.id },
    select: { id: true },
  });
  return client?.id ?? null;
}
