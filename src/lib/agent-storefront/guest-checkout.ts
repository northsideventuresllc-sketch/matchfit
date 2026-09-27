import "server-only";

import { getStripe } from "@/lib/stripe-server";
import { loadTrainerProfileAnswersAndOfferings, publishedPurchaseSkusFromLine } from "@/lib/trainer-service-offerings";
import { parseTrainerServiceOfferingsJson } from "@/lib/trainer-service-offerings-document";

const MAX_META = 480; // Stripe metadata values cap at 500 chars

export type AgentGuestCheckoutInput = {
  /** Which agent-storefront tool initiated this (for metadata/audit only). */
  tool: string;
  trainerId: string;
  /**
   * The trainer's published SKU key for the service being booked
   * (`PublishedPurchaseSku.checkoutKey`, e.g. `personal_training` or
   * `personal_training:tier-2`). The caller never supplies a price — it is
   * always looked up server-side from the trainer's own published offerings,
   * so an agent (or a tampered client) cannot set an arbitrary charge.
   */
  checkoutKey: string;
  buyerEmail?: string;
  params?: Record<string, unknown>;
};

export type AgentGuestCheckoutResult =
  | { status: "awaiting_payment"; checkoutUrl: string; orderId: string; amountUsd: number; message: string }
  | { status: "unavailable"; message: string }
  | { status: "invalid_input"; message: string };

const SUCCESS_PATH = "/booking-confirmed";

/**
 * Looks up the trainer's own published price for a service SKU. Never trusts a
 * client/agent-supplied amount — the only inputs that decide price are the
 * trainer id and the published `checkoutKey`, both resolved against
 * `TrainerProfile.serviceOfferingsJson`, the same source
 * `createTrainerServiceSaleStripeCheckoutSession` (the authenticated checkout
 * path) uses.
 */
async function lookUpPublishedServicePriceCents(
  trainerId: string,
  checkoutKey: string,
): Promise<{ priceCents: number; label: string } | null> {
  const profile = await loadTrainerProfileAnswersAndOfferings(trainerId);
  if (!profile) return null;
  const doc = parseTrainerServiceOfferingsJson(profile.serviceOfferingsJson);
  for (const line of doc.services) {
    const sku = publishedPurchaseSkusFromLine(line).find((s) => s.checkoutKey === checkoutKey);
    if (sku) {
      return { priceCents: Math.round(sku.priceUsd * 100), label: sku.label };
    }
  }
  return null;
}

/**
 * Guest Stripe Checkout for an AI agent booking a coach on a buyer's behalf, with no
 * Match Fit account required up front. Mirrors the pattern already live in
 * northside-intelligence's `src/lib/webmcp/checkout.ts`: the Checkout Session id IS the
 * order id, and `orderId` (plus the buyer's email, if given) lets the buyer claim the
 * booking onto an account later via `claimGuestCheckoutOnSignup` below.
 *
 * NEW code only — does not read, call, or modify any existing Stripe/webhook/auth path.
 * `getStripe()` is the existing shared client accessor; nothing about it changes here.
 *
 * SECURITY: the charge amount is never taken from the caller. It is looked up
 * server-side from the trainer's own published service catalog
 * (`lookUpPublishedServicePriceCents`) by `trainerId` + `checkoutKey`, exactly
 * as the authenticated checkout path already does. This closes a price-tampering
 * hole where an earlier draft of this pilot accepted a client-supplied `amountCents`
 * directly into the Stripe line item.
 */
export async function createMatchFitAgentGuestCheckout(
  input: AgentGuestCheckoutInput,
): Promise<AgentGuestCheckoutResult> {
  const stripe = getStripe();
  if (!stripe) return { status: "unavailable", message: "Checkout is temporarily unavailable." };

  if (!input.trainerId?.trim() || !input.checkoutKey?.trim()) {
    return { status: "invalid_input", message: "Missing trainer or service." };
  }

  const paramsJson = JSON.stringify(input.params ?? {});
  if (paramsJson.length > MAX_META) {
    return { status: "invalid_input", message: "Parameters too large." };
  }

  const priced = await lookUpPublishedServicePriceCents(input.trainerId, input.checkoutKey);
  if (!priced || !(priced.priceCents > 0)) {
    return { status: "invalid_input", message: "That service is not published by this coach." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://match-fit.net";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: priced.priceCents,
          product_data: { name: priced.label.slice(0, 250) },
        },
        quantity: 1,
      },
    ],
    customer_email: input.buyerEmail || undefined,
    success_url: `${siteUrl}${SUCCESS_PATH}?agent_order={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/`,
    metadata: {
      source: "agent_storefront",
      tool: input.tool,
      trainerId: input.trainerId,
      checkoutKey: input.checkoutKey,
      params: paramsJson,
    },
  });

  if (!session.url) return { status: "unavailable", message: "Checkout is temporarily unavailable." };

  return {
    status: "awaiting_payment",
    checkoutUrl: session.url,
    orderId: session.id,
    amountUsd: priced.priceCents / 100,
    message: "Send checkoutUrl to the buyer. After payment, create a Match Fit account with the same email to attach this booking to it.",
  };
}

/**
 * Looks up a guest checkout session's paid/buyer-email state so it can be matched to a
 * new account at signup time. Read-only — does not touch the existing signup/auth routes;
 * wiring this into the real signup flow is left for a follow-up once this pilot lands,
 * per the ticket's "new code only" scope.
 */
export async function getAgentGuestCheckoutClaim(
  orderId: string,
): Promise<{ paid: boolean; buyerEmail: string | null } | null> {
  const stripe = getStripe();
  if (!stripe || !orderId?.trim()) return null;
  const session = await stripe.checkout.sessions.retrieve(orderId);
  return {
    paid: session.payment_status === "paid",
    buyerEmail: session.customer_details?.email ?? session.customer_email ?? null,
  };
}
