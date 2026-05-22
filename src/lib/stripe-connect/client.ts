import Stripe from "stripe";
import { requireStripeSecretKey, StripeConnectConfigError } from "./config";

let stripeClientSingleton: Stripe | null = null;

/**
 * Single Stripe client for all Connect sample requests (platform + connected accounts).
 * API version is chosen by the SDK; do not pin `apiVersion` unless you have a specific need.
 */
export function getStripeConnectClient(): Stripe {
  try {
    const key = requireStripeSecretKey();
    if (!stripeClientSingleton) {
      stripeClientSingleton = new Stripe(key, { typescript: true });
    }
    return stripeClientSingleton;
  } catch (e) {
    if (e instanceof StripeConnectConfigError) throw e;
    throw new StripeConnectConfigError(
      e instanceof Error ? e.message : "Could not initialize Stripe client.",
    );
  }
}

/** Returns null when STRIPE_SECRET_KEY is missing (for optional UI messaging). */
export function getStripeConnectClientOrNull(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return null;
  return getStripeConnectClient();
}
