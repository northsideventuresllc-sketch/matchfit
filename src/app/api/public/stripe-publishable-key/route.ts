import { hydrateStripeEnvFromDatabase } from "@/lib/hydrate-stripe-env";
import { getStripePublishableKey } from "@/lib/stripe-publishable";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Runtime publishable key for Stripe.js (safe to expose). Avoids build-time inlining gaps. */
export async function GET() {
  await hydrateStripeEnvFromDatabase();
  const publicKey = getStripePublishableKey();
  return NextResponse.json({
    configured: Boolean(publicKey),
    publicKey,
  });
}
