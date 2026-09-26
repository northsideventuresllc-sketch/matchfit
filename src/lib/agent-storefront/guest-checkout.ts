import { getStripe } from "@/lib/stripe-server";

const MAX_META = 480; // Stripe metadata values cap at 500 chars

export type AgentGuestCheckoutInput = {
  /** Which agent-storefront tool initiated this (for metadata/audit only). */
  tool: string;
  trainerId: string;
  serviceName: string;
  amountCents: number;
  buyerEmail?: string;
  params?: Record<string, unknown>;
};

export type AgentGuestCheckoutResult =
  | { status: "awaiting_payment"; checkoutUrl: string; orderId: string; amountUsd: number; message: string }
  | { status: "unavailable"; message: string }
  | { status: "invalid_input"; message: string };

const SUCCESS_PATH = "/booking-confirmed";

/**
 * Guest Stripe Checkout for an AI agent booking a coach on a buyer's behalf, with no
 * Match Fit account required up front. Mirrors the pattern already live in
 * northside-intelligence's `src/lib/webmcp/checkout.ts`: the Checkout Session id IS the
 * order id, and `orderId` (plus the buyer's email, if given) lets the buyer claim the
 * booking onto an account later via `claimGuestCheckoutOnSignup` below.
 *
 * NEW code only — does not read, call, or modify any existing Stripe/webhook/auth path.
 * `getStripe()` is the existing shared client accessor; nothing about it changes here.
 */
export async function createMatchFitAgentGuestCheckout(
  input: AgentGuestCheckoutInput,
): Promise<AgentGuestCheckoutResult> {
  const stripe = getStripe();
  if (!stripe) return { status: "unavailable", message: "Checkout is temporarily unavailable." };

  if (!input.trainerId?.trim() || !input.serviceName?.trim() || !(input.amountCents > 0)) {
    return { status: "invalid_input", message: "Missing trainer, service, or amount." };
  }

  const paramsJson = JSON.stringify(input.params ?? {});
  if (paramsJson.length > MAX_META) {
    return { status: "invalid_input", message: "Parameters too large." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://match-fit.net";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: input.amountCents,
          product_data: { name: input.serviceName },
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
      params: paramsJson,
    },
  });

  if (!session.url) return { status: "unavailable", message: "Checkout is temporarily unavailable." };

  return {
    status: "awaiting_payment",
    checkoutUrl: session.url,
    orderId: session.id,
    amountUsd: input.amountCents / 100,
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
