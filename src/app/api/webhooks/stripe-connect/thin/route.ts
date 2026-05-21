import { NextResponse } from "next/server";
import { getStripeConnectClient } from "@/lib/stripe-connect/client";
import { requireStripeConnectThinWebhookSecret, StripeConnectConfigError } from "@/lib/stripe-connect/config";
import { parseConnectThinEventNotification } from "@/lib/stripe-connect/thin-events";
import { handleConnectThinEventNotification } from "@/lib/stripe-connect/thin-webhook-handlers";

export const dynamic = "force-dynamic";

/**
 * Thin webhook destination for V2 connected account events.
 *
 * Local testing:
 * stripe listen --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account[configuration.customer].capability_status_updated' --forward-thin-to http://localhost:3000/api/webhooks/stripe-connect/thin
 */
export async function POST(req: Request) {
  let secret: string;
  try {
    secret = requireStripeConnectThinWebhookSecret();
  } catch (e) {
    const msg = e instanceof StripeConnectConfigError ? e.message : "Thin webhooks not configured.";
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

  try {
    // Node SDK: parseEventNotification (docs may say parseThinEvent — same verification path).
    const notification = parseConnectThinEventNotification(stripeClient, rawBody, signature, secret);

    await handleConnectThinEventNotification(notification);

    return NextResponse.json({ received: true, eventId: notification.id, type: notification.type });
  } catch (e) {
    console.error("[stripe-connect] thin webhook", e);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 400 });
  }
}
