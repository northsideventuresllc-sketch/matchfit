import { stripeConfigHealth } from "@/lib/stripe-config";
import { hydrateStripeEnvFromDatabase } from "@/lib/hydrate-stripe-env";
import { stripeSecretHealth } from "@/lib/stripe-secret-health";
import { stripePublishableKeySource } from "@/lib/stripe-publishable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public readiness check for trainer signup card authorization (no secrets exposed). */
export async function GET() {
  await hydrateStripeEnvFromDatabase();
  const health = stripeConfigHealth();
  const secretProbe = await stripeSecretHealth();
  const publishableKeySource = stripePublishableKeySource();

  let message: string;
  if (health.healthy && secretProbe.apiReachable) {
    message = "Trainer signup card authorization is configured.";
  } else if (!secretProbe.configured) {
    message = "STRIPE_SECRET_KEY is missing in production environment variables.";
  } else if (!secretProbe.apiReachable) {
    message = `STRIPE_SECRET_KEY is set but Stripe rejected API calls: ${secretProbe.error ?? "unknown error"}`;
  } else if (!health.stripePublishableConfigured) {
    message =
      "Stripe publishable key is missing. Add STRIPE_PUBLISHABLE_KEY or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in Vercel production, then refresh.";
  } else {
    message = "Trainer signup card authorization is partially configured.";
  }

  return NextResponse.json({
    ...health,
    publishableKeySource,
    stripeSecretApiReachable: secretProbe.apiReachable,
    stripeLiveMode: secretProbe.liveMode,
    stripeSecretError: secretProbe.error,
    deployCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    message,
  });
}
