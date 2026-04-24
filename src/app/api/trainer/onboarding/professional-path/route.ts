import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { trainerProfessionalPathSchema } from "@/lib/validations/trainer-professional-path";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = trainerProfessionalPathSchema.safeParse(await req.json());
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid selection.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { trackCpt, trackNutrition } = parsed.data;

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        onboardingTrackCpt: trackCpt,
        onboardingTrackNutrition: trackNutrition,
      },
    });

    return NextResponse.json({ ok: true, trackCpt, trackNutrition });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not save your professional path.", {
      logLabel: "[Match Fit trainer professional path]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
