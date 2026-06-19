import { applyTrainerDeferredSignupChoice } from "@/lib/trainer-deferred-fee";
import { DEFERRED_FEE_MIN_WITHHOLD_PCT } from "@/lib/trainer-deferred-fee-constants";
import { createTrainerSignupBackgroundEscrowPaymentIntent } from "@/lib/trainer-signup-fee-hold";
import { computeTrainerSignupEscrowSplit } from "@/lib/trainer-signup-escrow";
import { hydrateStripeEnvFromDatabase } from "@/lib/hydrate-stripe-env";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isStripeSecretConfigured } from "@/lib/stripe-config";
import { parseTrainerRegistrationPricingMode } from "@/lib/trainer-registration-pricing-mode";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

    const body = (await req.json().catch(() => ({}))) as { withholdPct?: number };
    const withholdPct = Math.max(
      DEFERRED_FEE_MIN_WITHHOLD_PCT,
      Math.min(100, Math.floor(Number(body.withholdPct ?? DEFERRED_FEE_MIN_WITHHOLD_PCT))),
    );

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
        registrationFeePricingMode: true,
        hasPaidRegistrationFee: true,
      },
    });
    if (!profile?.hasSignedTOS) {
      return NextResponse.json({ error: "Accept the Fitness Pro agreement before payment." }, { status: 400 });
    }
    const pricingMode = parseTrainerRegistrationPricingMode(profile.registrationFeePricingMode);
    if (pricingMode !== "STANDARD_100_MINUS_BG") {
      return NextResponse.json({ error: "Deferred fee is only available for standard signup pricing." }, { status: 400 });
    }
    const hold = (profile.registrationFeeHoldStatus ?? "").trim().toUpperCase();
    if (hold === "HELD" || hold === "CAPTURED" || hold === "DEFERRED" || profile.hasPaidRegistrationFee) {
      return NextResponse.json({ error: "Signup fee step already completed." }, { status: 400 });
    }

    await applyTrainerDeferredSignupChoice({ trainerId, withholdPct });

    const bg = await createTrainerSignupBackgroundEscrowPaymentIntent({
      trainerId,
      email: trainer.email,
      pricingMode,
    });

    const split = computeTrainerSignupEscrowSplit(pricingMode);
    return NextResponse.json({
      ok: true,
      deferred: true,
      withholdPct,
      balanceCents: split.platformEscrowCents,
      backgroundCheckClientSecret: bg?.clientSecret ?? null,
      backgroundCheckPaymentIntentId: bg?.paymentIntentId ?? null,
      backgroundCheckHoldRequired: Boolean(bg),
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save deferred fee choice.", {
      logLabel: "[trainer signup choose-deferred-fee]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
