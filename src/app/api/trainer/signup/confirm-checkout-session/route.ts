import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import {
  applyTrainerSignupFeeHoldAuthorized,
  applyTrainerSignupPlatformHoldAuthorized,
} from "@/lib/trainer-compliance-window-sync";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
import {
  paymentIntentIdFromCheckoutSession,
  TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE,
} from "@/lib/trainer-signup-fee-hold-checkout";
import {
  isTrainerSignupBackgroundEscrowPaymentIntent,
  isTrainerSignupPlatformHoldPaymentIntent,
  retrieveTrainerSignupPaymentIntent,
  trainerSignupPaymentIntentReady,
} from "@/lib/trainer-signup-fee-hold";
import { computeTrainerSignupCombinedHoldCents } from "@/lib/trainer-signup-escrow";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  backgroundCheckPaymentIntentId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Checkout session id is required." }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    }

    const session = await stripe.checkout.sessions.retrieve(parsed.data.sessionId, {
      expand: ["payment_intent"],
    });

    const purpose = session.metadata?.purpose?.trim();
    if (purpose !== TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE && purpose !== "trainer_signup_fee_hold") {
      return NextResponse.json({ error: "Invalid checkout session." }, { status: 400 });
    }
    if (session.metadata?.trainerId !== trainerId) {
      return NextResponse.json({ error: "Checkout session does not belong to this account." }, { status: 403 });
    }

    const paymentIntentId = paymentIntentIdFromCheckoutSession(session.payment_intent);
    if (!paymentIntentId) {
      return NextResponse.json({ error: "Payment has not completed yet." }, { status: 400 });
    }

    const pi = await retrieveTrainerSignupPaymentIntent(paymentIntentId);
    if (!isTrainerSignupPlatformHoldPaymentIntent(pi)) {
      return NextResponse.json({ error: "Invalid payment." }, { status: 400 });
    }
    if (pi.metadata?.trainerId !== trainerId) {
      return NextResponse.json({ error: "Payment does not belong to this account." }, { status: 403 });
    }
    if (!trainerSignupPaymentIntentReady(pi)) {
      return NextResponse.json({ error: "Payment has not completed yet." }, { status: 400 });
    }

    const pendingBackgroundCheckPaymentIntentId =
      session.metadata?.backgroundCheckPaymentIntentId?.trim() || "";
    const confirmedBackgroundCheckPaymentIntentId =
      parsed.data.backgroundCheckPaymentIntentId?.trim() || "";

    const pricingMode =
      pi.metadata?.pricingMode === "STANDARD_100_MINUS_BG"
        ? "STANDARD_100_MINUS_BG"
        : "FOUNDING_BG_SURCHARGE_20PCT";

    if (confirmedBackgroundCheckPaymentIntentId) {
      const bgPi = await retrieveTrainerSignupPaymentIntent(confirmedBackgroundCheckPaymentIntentId);
      if (!isTrainerSignupBackgroundEscrowPaymentIntent(bgPi)) {
        return NextResponse.json({ error: "Invalid background check payment." }, { status: 400 });
      }
      if (bgPi.metadata?.trainerId !== trainerId) {
        return NextResponse.json({ error: "Payment does not belong to this account." }, { status: 403 });
      }
      if (!trainerSignupPaymentIntentReady(bgPi)) {
        return NextResponse.json({ error: "Background check authorization has not completed yet." }, { status: 400 });
      }

      await applyTrainerSignupFeeHoldAuthorized({
        trainerId,
        paymentIntentId: pi.id,
        backgroundCheckEscrowPaymentIntentId: confirmedBackgroundCheckPaymentIntentId,
        paidCents: computeTrainerSignupCombinedHoldCents(pricingMode),
        pricingMode,
      });
    } else {
      await applyTrainerSignupPlatformHoldAuthorized({
        trainerId,
        paymentIntentId: pi.id,
        pendingBackgroundCheckEscrowPaymentIntentId: pendingBackgroundCheckPaymentIntentId || null,
        paidCents: typeof pi.amount === "number" ? pi.amount : 0,
        pricingMode,
      });
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        hasSignedTOS: true,
        registrationFeeHoldStatus: true,
        backgroundCheckEscrowHoldStatus: true,
        hasPaidRegistrationFee: true,
        limitedDashboardUnlockedAt: true,
        onboardingFeePaymentDeadlineAt: true,
        onboardingFeePaymentExpiredAt: true,
      },
    });

    const needsBackgroundCheckAuthorization =
      Boolean(pendingBackgroundCheckPaymentIntentId) &&
      !confirmedBackgroundCheckPaymentIntentId &&
      (profile?.backgroundCheckEscrowHoldStatus ?? "").trim().toUpperCase() !== "HELD";

    return NextResponse.json({
      ok: true,
      next: resolveTrainerSignupNextPath(profile),
      needsBackgroundCheckAuthorization,
      backgroundCheckPaymentIntentId: pendingBackgroundCheckPaymentIntentId || null,
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not confirm payment.", {
      logLabel: "[trainer signup confirm checkout]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
