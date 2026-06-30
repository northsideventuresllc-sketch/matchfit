import { resolveClientVipStripePriceId } from "@/lib/client-stripe-price-id";
import { prisma } from "@/lib/prisma";
import { getStripe, stripeObjectIsLiveBilling } from "@/lib/stripe-server";
import type Stripe from "stripe";

export const CLIENT_VIP_STRIPE_PRICE_ENV = "MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID";

export function getClientVipStripePriceId(): string | null {
  return resolveClientVipStripePriceId();
}

/** True when a Stripe subscription line item uses the configured Client VIP price id. */
export function subscriptionUsesClientVipPrice(sub: Stripe.Subscription): boolean {
  const vipPriceId = getClientVipStripePriceId();
  if (!vipPriceId) return false;
  for (const item of sub.items?.data ?? []) {
    const price = item.price;
    const id = typeof price === "string" ? price : price?.id;
    if (id === vipPriceId) return true;
  }
  return false;
}

export async function createVipCheckoutSession(
  clientId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string; sessionId: string } | { error: string }> {
  const stripe = getStripe();
  const priceId = getClientVipStripePriceId();
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
  const clientId = await resolveClientIdFromVipSubscription(sub);
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
  sub: {
    id: string;
    metadata?: Record<string, string> | null;
    customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
  },
): Promise<string | null> {
  const fromMeta = sub.metadata?.clientId?.trim();
  if (fromMeta) return fromMeta;

  const client = await prisma.client.findFirst({
    where: { vipSubscriptionId: sub.id },
    select: { id: true },
  });
  if (client) return client.id;

  const customerId =
    typeof sub.customer === "string"
      ? sub.customer.trim()
      : sub.customer && typeof sub.customer === "object" && "id" in sub.customer
        ? sub.customer.id
        : null;
  if (!customerId) return null;

  const byCustomer = await prisma.client.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return byCustomer?.id ?? null;
}

export function isClientVipSubscription(sub: Stripe.Subscription): boolean {
  if (sub.metadata?.purpose?.trim() === "client_vip") return true;
  return subscriptionUsesClientVipPrice(sub);
}
