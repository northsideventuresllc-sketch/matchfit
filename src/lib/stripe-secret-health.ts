import "server-only";

import { getStripe } from "@/lib/stripe-server";

export type StripeSecretHealth = {
  configured: boolean;
  apiReachable: boolean;
  liveMode: boolean | null;
  error: string | null;
};

/** Confirms STRIPE_SECRET_KEY initializes and Stripe accepts API calls. */
export async function stripeSecretHealth(): Promise<StripeSecretHealth> {
  const stripe = getStripe();
  if (!stripe) {
    return { configured: false, apiReachable: false, liveMode: null, error: "STRIPE_SECRET_KEY is not set." };
  }

  try {
    const balance = await stripe.balance.retrieve();
    return {
      configured: true,
      apiReachable: true,
      liveMode: balance.livemode,
      error: null,
    };
  } catch (e) {
    return {
      configured: true,
      apiReachable: false,
      liveMode: null,
      error: e instanceof Error ? e.message : "Stripe API call failed.",
    };
  }
}
