import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { verifyTrainerOnboardingDevPassword } from "@/lib/trainer-dev-bypass";
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

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success || !verifyTrainerOnboardingDevPassword(parsed.data.devPassword)) {
      return NextResponse.json({ error: "Incorrect development password." }, { status: 403 });
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
