import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { verifyTrainerOnboardingDevPassword } from "@/lib/trainer-dev-bypass";
import { maybeActivateTrainerDashboard } from "@/lib/trainer-onboarding-dashboard";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  devPassword: z.string(),
  scopes: z.array(z.enum(["cpt", "nutritionist", "specialist"])).optional(),
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

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        onboardingTrackCpt: true,
        onboardingTrackNutrition: true,
        onboardingTrackSpecialist: true,
      },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 400 });
    }

    let scopes = parsed.data.scopes;
    if (!scopes?.length) {
      scopes = [];
      if (profile.onboardingTrackCpt) scopes.push("cpt");
      if (profile.onboardingTrackNutrition) scopes.push("nutritionist");
      if (profile.onboardingTrackSpecialist) scopes.push("specialist");
      if (!scopes.length) scopes = ["cpt"];
    }

    const data: {
      certificationReviewStatus?: string;
      nutritionistCertificationReviewStatus?: string;
      specialistCertificationReviewStatus?: string;
    } = {};
    if (scopes.includes("cpt")) {
      data.certificationReviewStatus = "APPROVED";
    }
    if (scopes.includes("nutritionist")) {
      data.nutritionistCertificationReviewStatus = "APPROVED";
    }
    if (scopes.includes("specialist")) {
      data.specialistCertificationReviewStatus = "APPROVED";
    }

    await prisma.trainerProfile.update({
      where: { trainerId },
      data,
    });

    await maybeActivateTrainerDashboard(trainerId);

    return NextResponse.json({ ok: true, scopes });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not bypass certification.", {
      logLabel: "[Match Fit trainer certification bypass]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
