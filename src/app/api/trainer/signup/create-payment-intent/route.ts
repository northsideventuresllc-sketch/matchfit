import { hydrateStripeEnvFromDatabase } from "@/lib/hydrate-stripe-env";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isStripeSecretConfigured } from "@/lib/stripe-config";
import { createTrainerSignupFeeHoldPaymentIntents } from "@/lib/trainer-signup-fee-hold";
import { parseTrainerRegistrationPricingMode } from "@/lib/trainer-registration-pricing-mode";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
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
      select: { email: true, deidentifiedAt: true, registrationFeeDeferred: true },
    });
    if (!trainer || trainer.deidentifiedAt) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (trainer.registrationFeeDeferred) {
      return NextResponse.json({ error: "You chose the deferred fee option. Continue with background screening authorization." }, { status: 400 });
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        hasSignedTOS: true,
        registrationFeeHoldStatus: true,
        backgroundCheckEscrowHoldStatus: true,
        hasPaidRegistrationFee: true,
        registrationFeePricingMode: true,
      },
    });
    if (!profile?.hasSignedTOS) {
      return NextResponse.json({ error: "Accept the Fitness Pro agreement before payment." }, { status: 400 });
    }
    const platformHold = (profile.registrationFeeHoldStatus ?? "").trim().toUpperCase();
    const bgHold = (profile.backgroundCheckEscrowHoldStatus ?? "").trim().toUpperCase();
    if (
      platformHold === "HELD" ||
      platformHold === "CAPTURED" ||
      bgHold === "HELD" ||
      bgHold === "CAPTURED" ||
      profile.hasPaidRegistrationFee
    ) {
      return NextResponse.json({ error: "Signup fee already authorized." }, { status: 400 });
    }

    const pricingMode = parseTrainerRegistrationPricingMode(profile.registrationFeePricingMode);

    const intents = await createTrainerSignupFeeHoldPaymentIntents({
      trainerId,
      email: trainer.email,
      pricingMode,
    });

    return NextResponse.json({
      clientSecret: intents.platformClientSecret,
      paymentIntentId: intents.platformPaymentIntentId,
      backgroundCheckClientSecret: intents.backgroundCheckClientSecret,
      backgroundCheckPaymentIntentId: intents.backgroundCheckPaymentIntentId,
      backgroundCheckHoldRequired: intents.backgroundCheckHoldRequired,
      baseCents: intents.baseCents,
      totalCents: intents.totalCents,
      platformHoldCents: intents.platformHoldCents,
      backgroundCheckHoldCents: intents.backgroundCheckHoldCents,
      pricingMode,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not start payment.";
    if (msg.includes("STRIPE_SECRET_KEY") || msg.includes("Billing is not configured")) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    }
    const { message, status } = publicApiErrorFromUnknown(e, "Could not start payment.", {
      logLabel: "[trainer signup payment intent]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
