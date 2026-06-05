/** Client-safe publishable key (must be set for Stripe.js / Payment Element). */
export function getStripePublishableKey(): string | null {
  const fromPublic = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (fromPublic) return fromPublic;
  const fromServer = process.env.STRIPE_PUBLISHABLE_KEY?.trim();
  return fromServer || null;
}

export function stripePublishableKeySource(): "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" | "STRIPE_PUBLISHABLE_KEY" | null {
  if (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
    return "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY";
  }
  if (process.env.STRIPE_PUBLISHABLE_KEY?.trim()) {
    return "STRIPE_PUBLISHABLE_KEY";
  }
  return null;
}

export function requireStripePublishableKey(): string {
  const key = getStripePublishableKey();
  if (!key) {
    throw new Error(
      "Stripe publishable key is not set. Add STRIPE_PUBLISHABLE_KEY or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in Vercel.",
    );
  }
  return key;
}

export function isStripePublishableConfigured(): boolean {
  return Boolean(getStripePublishableKey());
}
