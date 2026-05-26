/** Client-safe publishable key (must be set for Stripe.js / Payment Element). */
export function getStripePublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return key || null;
}

export function requireStripePublishableKey(): string {
  const key = getStripePublishableKey();
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Add it to .env (or Vercel) for Stripe payments.",
    );
  }
  return key;
}

export function isStripePublishableConfigured(): boolean {
  return Boolean(getStripePublishableKey());
}
