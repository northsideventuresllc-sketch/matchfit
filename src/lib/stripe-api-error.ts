import Stripe from "stripe";

/** User-safe Stripe API error text for payment setup routes (no secret leakage). */
export function stripeApiErrorMessage(e: unknown): string | null {
  if (!(e instanceof Stripe.errors.StripeError)) return null;
  const code = e.code ? `[${e.code}] ` : "";
  return `${code}${e.message}`.trim();
}
