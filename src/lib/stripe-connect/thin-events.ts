import type Stripe from "stripe";
import { getStripeConnectClient } from "./client";

export type ConnectThinNotification = {
  id: string;
  type: string;
  related_object?: { id: string; type: string; url: string } | null;
};

/**
 * Thin (V2) webhook notifications use `stripe.parseEventNotification` in Node.
 * Stripe docs sometimes show `parseThinEvent` — same role: verify signature, return `{ id, type, ... }`.
 */
export function parseConnectThinEventNotification(
  stripeClient: Stripe,
  rawBody: string | Buffer,
  signature: string,
  secret: string,
): ConnectThinNotification {
  return stripeClient.parseEventNotification(
    rawBody,
    signature,
    secret,
  ) as ConnectThinNotification;
}

/** Full V2 event payload (use after parsing the thin notification). */
export async function retrieveConnectV2Event(eventId: string) {
  const stripeClient = getStripeConnectClient();
  return stripeClient.v2.core.events.retrieve(eventId);
}
