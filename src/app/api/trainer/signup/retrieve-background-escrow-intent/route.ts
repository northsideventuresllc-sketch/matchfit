import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import {
  isTrainerSignupBackgroundEscrowPaymentIntent,
  retrieveTrainerSignupPaymentIntent,
} from "@/lib/trainer-signup-fee-hold";
import { getStripe } from "@/lib/stripe-server";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        backgroundCheckEscrowPaymentIntentId: true,
        backgroundCheckEscrowHoldStatus: true,
      },
    });

    const paymentIntentId = profile?.backgroundCheckEscrowPaymentIntentId?.trim();
    if (!paymentIntentId) {
      return NextResponse.json({ error: "No background check authorization is pending." }, { status: 400 });
    }
    if ((profile?.backgroundCheckEscrowHoldStatus ?? "").trim().toUpperCase() === "HELD") {
      return NextResponse.json({ error: "Background check authorization is already complete." }, { status: 400 });
    }

    const pi = await retrieveTrainerSignupPaymentIntent(paymentIntentId);
    if (!isTrainerSignupBackgroundEscrowPaymentIntent(pi)) {
      return NextResponse.json({ error: "Invalid payment." }, { status: 400 });
    }
    if (pi.metadata?.trainerId !== trainerId) {
      return NextResponse.json({ error: "Payment does not belong to this account." }, { status: 403 });
    }
    if (!pi.client_secret) {
      return NextResponse.json({ error: "Could not load secure authorization." }, { status: 500 });
    }

    return NextResponse.json({
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      amountCents: typeof pi.amount === "number" ? pi.amount : 0,
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not load authorization.", {
      logLabel: "[trainer signup retrieve background escrow]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
