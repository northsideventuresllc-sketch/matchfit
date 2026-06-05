import "server-only";

import { getStripePublishableKey } from "@/lib/stripe-publishable";
import { getStripe } from "@/lib/stripe-server";

/** Server-side: secret key present and Stripe client initializes. */
export function isStripeSecretConfigured(): boolean {
  return getStripe() != null;
}

/** Server-side: publishable key available for Stripe.js / Payment Element. */
export function isStripePublishableConfigured(): boolean {
  return Boolean(getStripePublishableKey());
}

/** Both keys required for trainer signup card authorization. */
export function isTrainerSignupStripeConfigured(): boolean {
  return isStripeSecretConfigured() && isStripePublishableConfigured();
}

export type StripeConfigHealth = {
  stripeSecretConfigured: boolean;
  stripePublishableConfigured: boolean;
  healthy: boolean;
};

export function stripeConfigHealth(): StripeConfigHealth {
  const stripeSecretConfigured = isStripeSecretConfigured();
  const stripePublishableConfigured = isStripePublishableConfigured();
  return {
    stripeSecretConfigured,
    stripePublishableConfigured,
    healthy: stripeSecretConfigured && stripePublishableConfigured,
  };
}
