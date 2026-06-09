import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { applyTrainerSignupPlatformHoldAuthorized } from "@/lib/trainer-compliance-window-sync";
import {
  isTrainerSignupPlatformHoldPaymentIntent,
  retrieveTrainerSignupPaymentIntent,
  trainerSignupPaymentIntentReady,
} from "@/lib/trainer-signup-fee-hold";
import { getStripe } from "@/lib/stripe-server";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  paymentIntentId: z.string().min(1),
  backgroundCheckPaymentIntentId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Payment intent ids are required." }, { status: 400 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    }

    const pi = await retrieveTrainerSignupPaymentIntent(parsed.data.paymentIntentId);
    if (!isTrainerSignupPlatformHoldPaymentIntent(pi)) {
      return NextResponse.json({ error: "Invalid payment." }, { status: 400 });
    }
    if (pi.metadata?.trainerId !== trainerId) {
      return NextResponse.json({ error: "Payment does not belong to this account." }, { status: 403 });
    }
    if (!trainerSignupPaymentIntentReady(pi)) {
      return NextResponse.json({ error: "Payment has not completed yet." }, { status: 400 });
    }

    const pricingMode =
      pi.metadata?.pricingMode === "STANDARD_100_MINUS_BG"
        ? "STANDARD_100_MINUS_BG"
        : "FOUNDING_BG_SURCHARGE_20PCT";

    await applyTrainerSignupPlatformHoldAuthorized({
      trainerId,
      paymentIntentId: pi.id,
      pendingBackgroundCheckEscrowPaymentIntentId: parsed.data.backgroundCheckPaymentIntentId,
      paidCents: typeof pi.amount === "number" ? pi.amount : 0,
      pricingMode,
    });

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: { registrationFeeHoldStatus: true },
    });

    return NextResponse.json({
      ok: true,
      registrationFeeHoldStatus: profile?.registrationFeeHoldStatus ?? null,
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not confirm payment.", {
      logLabel: "[trainer signup confirm platform hold]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
