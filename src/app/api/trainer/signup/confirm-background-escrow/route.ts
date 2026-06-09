import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { applyTrainerSignupBackgroundEscrowHoldAuthorized } from "@/lib/trainer-compliance-window-sync";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
import {
  isTrainerSignupBackgroundEscrowPaymentIntent,
  retrieveTrainerSignupPaymentIntent,
  trainerSignupPaymentIntentReady,
} from "@/lib/trainer-signup-fee-hold";
import { getStripe } from "@/lib/stripe-server";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  paymentIntentId: z.string().min(1),
});

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

    const pi = await retrieveTrainerSignupPaymentIntent(parsed.data.paymentIntentId);
    if (!isTrainerSignupBackgroundEscrowPaymentIntent(pi)) {
      return NextResponse.json({ error: "Invalid payment." }, { status: 400 });
    }
    if (pi.metadata?.trainerId !== trainerId) {
      return NextResponse.json({ error: "Payment does not belong to this account." }, { status: 403 });
    }
    if (!trainerSignupPaymentIntentReady(pi)) {
      return NextResponse.json({ error: "Payment has not completed yet." }, { status: 400 });
    }

    await applyTrainerSignupBackgroundEscrowHoldAuthorized({
      trainerId,
      paymentIntentId: pi.id,
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
    const { message, status } = publicApiErrorFromUnknown(e, "Could not confirm payment.", {
      logLabel: "[trainer signup confirm background escrow]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
