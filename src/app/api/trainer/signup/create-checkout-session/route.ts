import { getAppOriginFromRequest } from "@/lib/app-origin";
import { hydrateStripeEnvFromDatabase } from "@/lib/hydrate-stripe-env";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isStripeSecretConfigured } from "@/lib/stripe-config";
import { createTrainerSignupFeeHoldCheckoutSession } from "@/lib/trainer-signup-fee-hold-checkout";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Stripe Checkout redirect when publishable key is unavailable (secret key only). */
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

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { email: true, deidentifiedAt: true },
    });
    if (!trainer || trainer.deidentifiedAt) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        hasSignedTOS: true,
        registrationFeeHoldStatus: true,
        hasPaidRegistrationFee: true,
        registrationFeePricingMode: true,
      },
    });
    if (!profile?.hasSignedTOS) {
      return NextResponse.json({ error: "Accept the Fitness Pro agreement before payment." }, { status: 400 });
    }
    const hold = (profile.registrationFeeHoldStatus ?? "").trim().toUpperCase();
    if (hold === "HELD" || hold === "CAPTURED" || profile.hasPaidRegistrationFee) {
      return NextResponse.json({ error: "Signup fee already authorized." }, { status: 400 });
    }

    const pricingMode =
      profile.registrationFeePricingMode === "STANDARD_100_MINUS_BG"
        ? "STANDARD_100_MINUS_BG"
        : "FOUNDING_BG_SURCHARGE_20PCT";

    const { url, totalCents } = await createTrainerSignupFeeHoldCheckoutSession({
      trainerId,
      email: trainer.email,
      pricingMode,
      origin: getAppOriginFromRequest(req),
    });

    return NextResponse.json({ url, totalCents, mode: "checkout_redirect" as const });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not start payment.", {
      logLabel: "[trainer signup checkout session]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
