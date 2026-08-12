import { getAppOriginFromRequest } from "@/lib/app-origin";
import { hydrateStripeEnvFromDatabase } from "@/lib/hydrate-stripe-env";
import { getSessionTrainerId } from "@/lib/session";
import { isStripeSecretConfigured } from "@/lib/stripe-config";
import { createTrainerConnectOnboardingLink } from "@/lib/stripe-connect";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Starts (or resumes) Stripe Connect Express onboarding for the trainer's payout bank account. */
export async function POST(req: Request) {
  try {
    await hydrateStripeEnvFromDatabase();
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isStripeSecretConfigured()) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    }

    const origin = getAppOriginFromRequest(req);
    const { url } = await createTrainerConnectOnboardingLink({
      trainerId,
      returnUrl: `${origin}/api/trainer/payouts/connect/return`,
      refreshUrl: `${origin}/trainer/dashboard/billing?connect=refresh`,
    });

    return NextResponse.json({ url });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not start payout setup.", {
      logLabel: "[trainer payouts connect start]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
