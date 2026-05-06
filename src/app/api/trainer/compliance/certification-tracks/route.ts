import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { isTrainerComplianceComplete } from "@/lib/trainer-compliance-complete";
import { publicApiErrorFromUnknown } from "@/lib/public-api-error";
import { trainerComplianceCertTracksSchema } from "@/lib/validations/trainer-compliance-cert-tracks";

function isBlockingCertStatus(status: string | null | undefined): boolean {
  const s = (status ?? "NOT_STARTED").trim().toUpperCase();
  return s === "APPROVED" || s === "PENDING";
}

export async function PATCH(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const parsed = trainerComplianceCertTracksSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid selection.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { trackCpt, trackNutrition, trackSpecialist, specialistRole } = parsed.data;

    const existing = await prisma.trainerProfile.findUnique({
      where: { trainerId },
      select: {
        onboardingTrackCpt: true,
        onboardingTrackNutrition: true,
        onboardingTrackSpecialist: true,
        certificationReviewStatus: true,
        nutritionistCertificationReviewStatus: true,
        specialistCertificationReviewStatus: true,
        hasSignedTOS: true,
        hasUploadedW9: true,
        backgroundCheckStatus: true,
        dashboardActivatedAt: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Profile not found." }, { status: 400 });
    }

    const basic =
      existing.hasSignedTOS &&
      existing.hasUploadedW9 &&
      existing.backgroundCheckStatus.trim().toUpperCase() === "APPROVED";
    const complianceSlice = {
      hasSignedTOS: existing.hasSignedTOS,
      hasUploadedW9: existing.hasUploadedW9,
      backgroundCheckStatus: existing.backgroundCheckStatus,
      onboardingTrackCpt: existing.onboardingTrackCpt,
      onboardingTrackNutrition: existing.onboardingTrackNutrition,
      onboardingTrackSpecialist: existing.onboardingTrackSpecialist,
      certificationReviewStatus: existing.certificationReviewStatus,
      nutritionistCertificationReviewStatus: existing.nutritionistCertificationReviewStatus,
      specialistCertificationReviewStatus: existing.specialistCertificationReviewStatus,
    };
    const mayUseComplianceTools =
      basic && (existing.dashboardActivatedAt != null || isTrainerComplianceComplete(complianceSlice));
    if (!mayUseComplianceTools) {
      return NextResponse.json({ error: "Compliance profile is not eligible for this update yet." }, { status: 403 });
    }

    if (existing.onboardingTrackCpt && !trackCpt && isBlockingCertStatus(existing.certificationReviewStatus)) {
      return NextResponse.json(
        { error: "You cannot turn off the CPT path while a CPT file is pending or already approved." },
        { status: 400 },
      );
    }
    if (existing.onboardingTrackNutrition && !trackNutrition && isBlockingCertStatus(existing.nutritionistCertificationReviewStatus)) {
      return NextResponse.json(
        { error: "You cannot turn off the nutrition path while a nutrition credential is pending or already approved." },
        { status: 400 },
      );
    }
    if (existing.onboardingTrackSpecialist && !trackSpecialist && isBlockingCertStatus(existing.specialistCertificationReviewStatus)) {
      return NextResponse.json(
        { error: "You cannot turn off the specialist path while that credential is pending or already approved." },
        { status: 400 },
      );
    }

    await prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        onboardingTrackCpt: trackCpt,
        onboardingTrackNutrition: trackNutrition,
        onboardingTrackSpecialist: trackSpecialist,
        specialistProfessionalRole: trackSpecialist ? specialistRole ?? null : null,
      },
    });

    return NextResponse.json({
      ok: true,
      trackCpt,
      trackNutrition,
      trackSpecialist,
      specialistRole: trackSpecialist ? specialistRole ?? null : null,
    });
  } catch (e) {
    const { message, status } = publicApiErrorFromUnknown(e, "Could not update certification paths.", {
      logLabel: "[Match Fit trainer compliance certification tracks]",
    });
    return NextResponse.json({ error: message }, { status });
  }
}
