/**
 * Stripe Connect sample — environment configuration.
 *
 * Fill these in from the Stripe Dashboard (Developers → API keys / Webhooks).
 * The sample is isolated under `/stripe-connect-demo` and does not affect
 * production client/trainer billing unless you wire it in yourself.
 */

export class StripeConnectConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConnectConfigError";
  }
}

/** Platform secret key — use a restricted key (`rk_...`) in production when possible. */
export function requireStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new StripeConnectConfigError(
      "STRIPE_SECRET_KEY is not set. Add your Stripe secret (or restricted) key to `.env` — see `.env.example`.",
    );
  }
  return key;
}

/** Snapshot webhook secret for subscription / billing portal events (not thin). */
export function requireStripeConnectSubscriptionWebhookSecret(): string {
  const secret =
    process.env.STRIPE_CONNECT_SUBSCRIPTION_WEBHOOK_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new StripeConnectConfigError(
      "Set STRIPE_CONNECT_SUBSCRIPTION_WEBHOOK_SECRET (or STRIPE_WEBHOOK_SECRET) for subscription webhooks.",
    );
  }
  return secret;
}

/** Thin webhook secret from a Dashboard destination with payload style “Thin”. */
export function requireStripeConnectThinWebhookSecret(): string {
  const secret = process.env.STRIPE_CONNECT_THIN_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new StripeConnectConfigError(
      "STRIPE_CONNECT_THIN_WEBHOOK_SECRET is not set. Create a thin event destination in the Stripe Dashboard (see docs/stripe-connect-demo.md).",
    );
  }
  return secret;
}

/**
 * Platform subscription price for connected accounts (Checkout `mode: subscription`).
 * Create a recurring Price in the Dashboard and paste its ID here.
 */
export function requireStripeConnectPlatformPriceId(): string {
  const id = process.env.STRIPE_CONNECT_PLATFORM_PRICE_ID?.trim();
  if (!id) {
    throw new StripeConnectConfigError(
      "STRIPE_CONNECT_PLATFORM_PRICE_ID is not set. Create a Price for your platform plan and add its ID to `.env`.",
    );
  }
  return id;
}

/** Application fee on direct charges (basis points, e.g. 1000 = 10%). */
export function stripeConnectApplicationFeeBps(): number {
  const raw = process.env.STRIPE_CONNECT_APPLICATION_FEE_BPS?.trim();
  const n = raw ? parseInt(raw, 10) : 1000;
  return Number.isFinite(n) && n >= 0 && n <= 5000 ? n : 1000;
}

export function computeApplicationFeeCents(amountCents: number): number {
  const bps = stripeConnectApplicationFeeBps();
  return Math.max(0, Math.round((amountCents * bps) / 10_000));
}
