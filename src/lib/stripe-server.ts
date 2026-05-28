import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    return null;
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, { typescript: true });
  }
  return stripeSingleton;
}

/** True when `STRIPE_SECRET_KEY` is a live (non-test) secret. */
export function isStripeLiveSecretKey(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return Boolean(key?.startsWith("sk_live_"));
}

/** Stripe objects created under test keys report `livemode: false`. */
export function stripeObjectIsLiveBilling(livemode: boolean | null | undefined): boolean {
  return livemode === true;
}
