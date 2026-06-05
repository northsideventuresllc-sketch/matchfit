import { stripeConfigHealth } from "@/lib/stripe-config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public readiness check for trainer signup card authorization (no secrets exposed). */
export async function GET() {
  const health = stripeConfigHealth();
  let message: string;
  if (health.healthy) {
    message = "Trainer signup card authorization is configured.";
  } else if (!health.stripeSecretConfigured && !health.stripePublishableConfigured) {
    message = "Stripe secret and publishable keys are missing in production environment variables.";
  } else if (!health.stripeSecretConfigured) {
    message = "STRIPE_SECRET_KEY is missing in production environment variables.";
  } else {
    message = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing in production environment variables.";
  }

  return NextResponse.json({
    ...health,
    deployCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    message,
  });
}
