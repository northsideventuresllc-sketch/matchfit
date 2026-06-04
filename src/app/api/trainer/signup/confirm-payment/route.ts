import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { applyTrainerSignupFeeHoldAuthorized } from "@/lib/trainer-compliance-window-sync";
import { resolveTrainerSignupNextPath } from "@/lib/trainer-signup-next-path";
import { TRAINER_SIGNUP_FEE_HOLD_PURPOSE } from "@/lib/trainer-signup-fee-hold";
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

    const pi = await stripe.paymentIntents.retrieve(parsed.data.paymentIntentId);
    if (pi.metadata?.purpose !== TRAINER_SIGNUP_FEE_HOLD_PURPOSE) {
      return NextResponse.json({ error: "Invalid payment." }, { status: 400 });
    }
    if (pi.metadata?.trainerId !== trainerId) {
      return NextResponse.json({ error: "Payment does not belong to this account." }, { status: 403 });
    }
    if (pi.status !== "requires_capture" && pi.status !== "succeeded") {
      return NextResponse.json({ error: "Payment has not completed yet." }, { status: 400 });
    }

    const paidCents =
      typeof pi.amount_received === "number" && pi.amount_received > 0
        ? pi.amount_received
        : typeof pi.amount === "number"
          ? pi.amount
          : 0;

    await applyTrainerSignupFeeHoldAuthorized({
      trainerId,
      paymentIntentId: pi.id,
      paidCents,
    });

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        hasSignedTOS: true,
        registrationFeeHoldStatus: true,
        hasPaidRegistrationFee: true,
        limitedDashboardUnlockedAt: true,
      },
    });

    return NextResponse.json({ ok: true, next: resolveTrainerSignupNextPath(profile) });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not confirm payment.", {
      logLabel: "[trainer signup confirm payment]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
