import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerSignupStripeConfigured } from "@/lib/stripe-config";
import { createTrainerSignupFeeHoldPaymentIntent } from "@/lib/trainer-signup-fee-hold";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!isTrainerSignupStripeConfigured()) {
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
      return NextResponse.json({ error: "Accept the trainer agreement before payment." }, { status: 400 });
    }
    const hold = (profile.registrationFeeHoldStatus ?? "").trim().toUpperCase();
    if (hold === "HELD" || hold === "CAPTURED" || profile.hasPaidRegistrationFee) {
      return NextResponse.json({ error: "Signup fee already authorized." }, { status: 400 });
    }

    const pricingMode =
      profile.registrationFeePricingMode === "STANDARD_100_MINUS_BG"
        ? "STANDARD_100_MINUS_BG"
        : "FOUNDING_BG_SURCHARGE_20PCT";

    const { clientSecret, paymentIntentId, baseCents, totalCents } =
      await createTrainerSignupFeeHoldPaymentIntent({
        trainerId,
        email: trainer.email,
        pricingMode,
      });

    return NextResponse.json({
      clientSecret,
      paymentIntentId,
      baseCents,
      totalCents,
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
