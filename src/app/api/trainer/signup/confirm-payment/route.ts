import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { applyTrainerSignupFeeHoldAuthorized } from "@/lib/trainer-compliance-window-sync";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
import {
  isTrainerSignupBackgroundEscrowPaymentIntent,
  isTrainerSignupPlatformHoldPaymentIntent,
  retrieveTrainerSignupPaymentIntent,
  trainerSignupPaymentIntentReady,
  TRAINER_SIGNUP_BG_ESCROW_PURPOSE,
  TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE,
} from "@/lib/trainer-signup-fee-hold";
import { computeTrainerSignupCombinedHoldCents } from "@/lib/trainer-signup-escrow";
import { getStripe } from "@/lib/stripe-server";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  paymentIntentId: z.string().min(1),
  backgroundCheckPaymentIntentId: z.string().min(1).optional(),
});

async function assertSignupPaymentIntent(args: {
  paymentIntentId: string;
  trainerId: string;
  expectedPurpose: string;
  isValidPurpose: (pi: { metadata?: Record<string, string> | null }) => boolean;
}) {
  const pi = await retrieveTrainerSignupPaymentIntent(args.paymentIntentId);
  if (!args.isValidPurpose(pi)) {
    throw new Error("Invalid payment.");
  }
  if (pi.metadata?.trainerId !== args.trainerId) {
    throw new Error("Payment does not belong to this account.");
  }
  if (!trainerSignupPaymentIntentReady(pi)) {
    throw new Error("Payment has not completed yet.");
  }
  return pi;
}

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Payment intent id is required." }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    }

    const platformPi = await assertSignupPaymentIntent({
      paymentIntentId: parsed.data.paymentIntentId,
      trainerId,
      expectedPurpose: TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE,
      isValidPurpose: isTrainerSignupPlatformHoldPaymentIntent,
    });

    const backgroundCheckPiId = parsed.data.backgroundCheckPaymentIntentId?.trim() ?? "";
    if (backgroundCheckPiId) {
      await assertSignupPaymentIntent({
        paymentIntentId: backgroundCheckPiId,
        trainerId,
        expectedPurpose: TRAINER_SIGNUP_BG_ESCROW_PURPOSE,
        isValidPurpose: isTrainerSignupBackgroundEscrowPaymentIntent,
      });
    }

    const pricingMode =
      platformPi.metadata?.pricingMode === "STANDARD_100_MINUS_BG"
        ? "STANDARD_100_MINUS_BG"
        : "FOUNDING_BG_SURCHARGE_20PCT";

    const paidCents = backgroundCheckPiId
      ? computeTrainerSignupCombinedHoldCents(pricingMode)
      : typeof platformPi.amount === "number"
        ? platformPi.amount
        : 0;

    await applyTrainerSignupFeeHoldAuthorized({
      trainerId,
      paymentIntentId: platformPi.id,
      backgroundCheckEscrowPaymentIntentId: backgroundCheckPiId || null,
      paidCents,
      pricingMode,
    });

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        hasSignedTOS: true,
        registrationFeeHoldStatus: true,
        hasPaidRegistrationFee: true,
        limitedDashboardUnlockedAt: true,
        onboardingFeePaymentDeadlineAt: true,
        onboardingFeePaymentExpiredAt: true,
      },
    });

    return NextResponse.json({ ok: true, next: resolveTrainerSignupNextPath(profile) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not confirm payment.";
    const status =
      message === "Invalid payment." || message === "Payment has not completed yet."
        ? 400
        : message === "Payment does not belong to this account."
          ? 403
          : 500;
    if (status === 500) {
      const mapped = publicApiErrorFromUnknown(e, "Could not confirm payment.", {
        logLabel: "[trainer signup confirm payment]",
      });
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
    return NextResponse.json({ error: message }, { status });
  }
}
