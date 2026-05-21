import { NextResponse } from "next/server";
import { getStripeConnectClient } from "@/lib/stripe-connect/client";
import {
  requireStripeConnectSubscriptionWebhookSecret,
  StripeConnectConfigError,
} from "@/lib/stripe-connect/config";
import { handleConnectSubscriptionWebhookEvent } from "@/lib/stripe-connect/subscription-webhooks";

export const dynamic = "force-dynamic";

const HANDLED_TYPES = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "payment_method.attached",
  "payment_method.detached",
  "customer.updated",
]);

/**
 * Standard (snapshot) webhooks for platform subscriptions on connected accounts.
 * Configure in Dashboard → Webhooks → your platform endpoint (not thin).
 */
export async function POST(req: Request) {
  let secret: string;
  try {
    secret = requireStripeConnectSubscriptionWebhookSecret();
  } catch (e) {
    const msg = e instanceof StripeConnectConfigError ? e.message : "Subscription webhooks not configured.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  let stripeClient;
  try {
    stripeClient = getStripeConnectClient();
  } catch (e) {
    const msg = e instanceof StripeConnectConfigError ? e.message : "Stripe not configured.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe-Signature header." }, { status: 400 });
  }

  const rawBody = await req.text();

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    console.error("[stripe-connect] subscription webhook signature", e);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    if (HANDLED_TYPES.has(event.type)) {
      await handleConnectSubscriptionWebhookEvent(event);
    }
    return NextResponse.json({ received: true, type: event.type });
  } catch (e) {
    console.error("[stripe-connect] subscription webhook handler", e);
    return NextResponse.json({ error: "Handler error." }, { status: 500 });
  }
}
