import { getStripe } from "@/lib/stripe-server";
import { hydrateStripeEnvFromDatabase } from "@/lib/hydrate-stripe-env";
import { readStripeWebhookRawBody } from "@/lib/stripe-webhook-raw-body";
import { syncTrainerConnectAccountStatus } from "@/lib/stripe-connect";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Separate endpoint from /api/webhooks/stripe: Stripe delivers "Connect" events (account.updated
 * for connected accounts) only to a webhook endpoint explicitly registered to receive them, with
 * its own signing secret — JB registers this URL + STRIPE_CONNECT_WEBHOOK_SECRET when he wires
 * the Connect credentials (same "create the code, I wire in credentials" split as everywhere else).
 */
export async function POST(req: Request) {
  const rawBody = await readStripeWebhookRawBody(req);

  await hydrateStripeEnvFromDatabase();
  const stripe = getStripe();
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Connect webhooks not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    console.error("Stripe Connect webhook signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      if (account.id) {
        await syncTrainerConnectAccountStatus(account.id);
      }
    }
  } catch (e) {
    console.error("Stripe Connect webhook handler error:", e);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
