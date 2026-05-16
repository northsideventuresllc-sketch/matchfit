import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { verifyTrainerOnboardingDevPassword } from "@/lib/trainer-dev-bypass";
import { verifyMatchFitInternalQaTrainerOnboardingBypass } from "@/lib/match-fit-internal-qa";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  devPassword: z.string(),
});

export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: { email: true, passwordHash: true },
    });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    const allowDev = verifyTrainerOnboardingDevPassword(parsed.success ? parsed.data.devPassword : "");
    const allowQa = parsed.success
      ? await verifyMatchFitInternalQaTrainerOnboardingBypass({
          trainerEmail: trainer.email,
          trainerPasswordHash: trainer.passwordHash,
          inputPassword: parsed.data.devPassword,
        })
      : false;
    if (!parsed.success || (!allowDev && !allowQa)) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
    }

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        onboardingTrackCpt: true,
        onboardingTrackNutrition: true,
        onboardingTrackSpecialist: false,
        specialistProfessionalRole: null,
      },
    });

    return NextResponse.json({
      ok: true,
      trackCpt: true,
      trackNutrition: true,
      trackSpecialist: false,
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not bypass professional path.", {
      logLabel: "[Match Fit trainer professional path bypass]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
