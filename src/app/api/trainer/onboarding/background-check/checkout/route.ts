import { prisma } from "@/lib/prisma";
import { requireTrainerOnboardingMutation } from "@/lib/trainer-onboarding-api";
import {
  createTrainerBackgroundCheckCheckoutSession,
  trainerOnboardingOriginFromRequest,
} from "@/lib/trainer-onboarding-stripe";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await requireTrainerOnboardingMutation();
    if ("error" in session) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }
    const { trainerId } = session;

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { email: true, launchCohortMember: true, profile: { select: { hasPaidBackgroundFee: true } } },
    });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (trainer.profile?.hasPaidBackgroundFee) {
      return NextResponse.json({ error: "Background check fee is already paid." }, { status: 400 });
    }

    const origin = trainerOnboardingOriginFromRequest(req);
    const url = await createTrainerBackgroundCheckCheckoutSession({
      trainerId,
      email: trainer.email,
      launchCohort: trainer.launchCohortMember,
      origin,
    });
    return NextResponse.json({ url });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not start checkout.", {
      logLabel: "[Match Fit trainer BG checkout]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
