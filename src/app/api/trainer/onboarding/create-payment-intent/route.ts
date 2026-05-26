import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { createTrainerBackgroundCheckPaymentIntent } from "@/lib/trainer-background-check-stripe";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
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
      select: { hasPaidBackgroundFee: true },
    });
    if (profile?.hasPaidBackgroundFee) {
      return NextResponse.json({ error: "Background check fee already paid." }, { status: 400 });
    }

    const { clientSecret, paymentIntentId } = await createTrainerBackgroundCheckPaymentIntent({
      trainerId,
      email: trainer.email,
    });

    return NextResponse.json({ clientSecret, paymentIntentId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not start payment.";
    if (msg.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    const { message, status } = publicApiErrorFromUnknown(e, "Could not start payment.", {
      logLabel: "[trainer background check payment intent]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
