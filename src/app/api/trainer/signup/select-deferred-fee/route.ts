import { createTrainerSignupBackgroundEscrowPaymentIntent } from "@/lib/trainer-signup-fee-hold";
import {
  DEFERRED_FEE_MIN_WITHHOLD_PCT,
  isTrainerDeferredFeeBanned,
} from "@/lib/trainer-deferred-fee";
import { computeTrainerRegistrationDueCents } from "@/lib/trainer-registration-fee";
import { hydrateStripeEnvFromDatabase } from "@/lib/hydrate-stripe-env";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isStripeSecretConfigured } from "@/lib/stripe-config";
import { parseTrainerRegistrationPricingMode } from "@/lib/trainer-registration-pricing-mode";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  withholdPct: z.number().int().min(DEFERRED_FEE_MIN_WITHHOLD_PCT).max(100),
});

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

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Withhold percentage must be between 20 and 100." }, { status: 400 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        email: true,
        deidentifiedAt: true,
        registrationFeeDeferredBannedAt: true,
      },
    });
    if (!trainer || trainer.deidentifiedAt) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (isTrainerDeferredFeeBanned(trainer)) {
      return NextResponse.json(
        { error: "TRAINER_SSN_BANNED", message: "This account is ineligible for registration." },
        { status: 403 },
      );
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        hasSignedTOS: true,
        registrationFeeHoldStatus: true,
        backgroundCheckEscrowHoldStatus: true,
        hasPaidRegistrationFee: true,
        registrationFeePricingMode: true,
        backgroundCheckVendorPaidCents: true,
      },
    });
    if (!profile?.hasSignedTOS) {
      return NextResponse.json({ error: "Accept the Fitness Pro agreement before payment." }, { status: 400 });
    }

    const pricingMode = parseTrainerRegistrationPricingMode(profile.registrationFeePricingMode);
    if (pricingMode !== "STANDARD_100_MINUS_BG") {
      return NextResponse.json({ error: "Deferred fee is only available for standard-tier signup." }, { status: 400 });
    }

    const hold = (profile.registrationFeeHoldStatus ?? "").trim().toUpperCase();
    const bgHold = (profile.backgroundCheckEscrowHoldStatus ?? "").trim().toUpperCase();
    if (hold === "HELD" || hold === "CAPTURED" || hold === "DEFERRED" || bgHold === "HELD" || bgHold === "CAPTURED" || profile.hasPaidRegistrationFee) {
      return NextResponse.json({ error: "Signup fee already authorized." }, { status: 400 });
    }

    const bgEstimate = profile.backgroundCheckVendorPaidCents ?? 4900;
    const { dueCents } = computeTrainerRegistrationDueCents({
      pricingMode: "STANDARD_100_MINUS_BG",
      backgroundCheckVendorPaidCents: bgEstimate,
    });

    const now = new Date();
    await prisma.$transaction([
      prisma.trainer.update({
        where: { id: trainerId },
        data: {
          registrationFeeDeferred: true,
          registrationFeeWithholdPct: parsed.data.withholdPct,
        },
      }),
      prisma.trainerProfile.update({
        where: { trainerId },
        data: {
          registrationFeeHoldStatus: "DEFERRED",
          limitedDashboardUnlockedAt: now,
          complianceWindowStartedAt: now,
          onboardingFeePaymentDeadlineAt: null,
          updatedAt: now,
        },
      }),
    ]);

    const bgIntent = await createTrainerSignupBackgroundEscrowPaymentIntent({
      trainerId,
      email: trainer.email,
      pricingMode,
    });
    if (!bgIntent) {
      return NextResponse.json({ error: "Background check authorization is required but unavailable." }, { status: 503 });
    }

    return NextResponse.json({
      deferred: true,
      dueCents,
      dueLabel: `$${(dueCents / 100).toFixed(2)}`,
      withholdPct: parsed.data.withholdPct,
      backgroundCheckClientSecret: bgIntent.clientSecret,
      backgroundCheckPaymentIntentId: bgIntent.paymentIntentId,
      backgroundCheckHoldCents: bgIntent.holdCents,
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not start deferred signup.", {
      logLabel: "[trainer signup deferred fee]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
