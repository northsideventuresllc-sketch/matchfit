import "server-only";

import {
  isPlaceholderResendApiKey,
  isPlaceholderResendFromEmail,
  isPlaceholderStripePublishableKey,
  isPlaceholderStripeSecretKey,
  isPlaceholderStripeWebhookSecret,
  readPlatformSecret,
  resolvePlatformSecret,
} from "@/lib/platform-secrets";
import { resetStripeClient } from "@/lib/stripe-server";

let hydratePromise: Promise<void> | null = null;

/** Loads live Stripe + Resend config from `platform_secrets` when Vercel env has placeholders. */
export async function hydratePlatformEnvFromDatabase(): Promise<void> {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const secret = await resolvePlatformSecret(
      "STRIPE_SECRET_KEY",
      process.env.STRIPE_SECRET_KEY,
      isPlaceholderStripeSecretKey,
    );
    if (secret) process.env.STRIPE_SECRET_KEY = secret;

    const publishable = await resolvePlatformSecret(
      "STRIPE_PUBLISHABLE_KEY",
      process.env.STRIPE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      isPlaceholderStripePublishableKey,
    );
    if (publishable) {
      process.env.STRIPE_PUBLISHABLE_KEY = publishable;
      if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = publishable;
      }
    }

    const webhook = await resolvePlatformSecret(
      "STRIPE_WEBHOOK_SECRET",
      process.env.STRIPE_WEBHOOK_SECRET,
      isPlaceholderStripeWebhookSecret,
    );
    if (webhook) process.env.STRIPE_WEBHOOK_SECRET = webhook;

    const resendKey = await readPlatformSecret("RESEND_API_KEY");
    if (resendKey) {
      process.env.RESEND_API_KEY = resendKey;
    } else {
      const resolved = await resolvePlatformSecret(
        "RESEND_API_KEY",
        process.env.RESEND_API_KEY,
        isPlaceholderResendApiKey,
      );
      if (resolved) process.env.RESEND_API_KEY = resolved;
    }

    const resendFrom = await readPlatformSecret("RESEND_FROM_EMAIL");
    if (resendFrom) {
      process.env.RESEND_FROM_EMAIL = resendFrom;
    } else {
      const resolved = await resolvePlatformSecret(
        "RESEND_FROM_EMAIL",
        process.env.RESEND_FROM_EMAIL,
        isPlaceholderResendFromEmail,
      );
      if (resolved) process.env.RESEND_FROM_EMAIL = resolved;
    }

    const anthropicKey = await readPlatformSecret("ANTHROPIC_API_KEY");
    if (anthropicKey) {
      process.env.ANTHROPIC_API_KEY = anthropicKey;
    }

    const anthropicModel = await readPlatformSecret("ANTHROPIC_ADMIN_ANALYTICS_MODEL");
    if (anthropicModel) {
      process.env.ANTHROPIC_ADMIN_ANALYTICS_MODEL = anthropicModel;
    }

    resetStripeClient();
  })();

  return hydratePromise;
}

/** @deprecated Use {@link hydratePlatformEnvFromDatabase}. */
export const hydrateStripeEnvFromDatabase = hydratePlatformEnvFromDatabase;
