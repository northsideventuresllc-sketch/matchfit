import { NextResponse } from "next/server";
import { computeTrainerRegistrationDueCents } from "@/lib/trainer-registration-fee";
import { getSessionTrainerId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { certificationsGatePassed } from "@/lib/trainer-onboarding-cert-gate";

export const dynamic = "force-dynamic";

export async function GET() {
  const trainerId = await getSessionTrainerId();
  if (!trainerId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      hasPaidRegistrationFee: true,
      hasPaidBackgroundFee: true,
      backgroundCheckVendorPaidCents: true,
      backgroundCheckStatus: true,
      registrationFeePricingMode: true,
      registrationFeeWaived: true,
      certificationReviewStatus: true,
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      onboardingTrackSpecialist: true,
      nutritionistCertificationReviewStatus: true,
      specialistCertificationReviewStatus: true,
    },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const bgCents = profile.backgroundCheckVendorPaidCents ?? 0;
  const certsOk = certificationsGatePassed(profile);
  const bgOk = profile.backgroundCheckStatus === "APPROVED" && profile.hasPaidBackgroundFee && bgCents > 0;

  const { dueCents, error: dueError } =
    bgOk && !profile.hasPaidRegistrationFee
      ? computeTrainerRegistrationDueCents({
          pricingMode:
            profile.registrationFeePricingMode === "STANDARD_100_MINUS_BG"
              ? "STANDARD_100_MINUS_BG"
              : "FOUNDING_BG_SURCHARGE_20PCT",
          backgroundCheckVendorPaidCents: bgCents,
        })
      : { dueCents: 0 };

  return NextResponse.json({
    hasPaidRegistrationFee: profile.hasPaidRegistrationFee,
    foundingPricing: profile.registrationFeePricingMode === "FOUNDING_BG_SURCHARGE_20PCT",
    backgroundCheckPaidCents: bgCents,
    canPay: bgOk && certsOk && !profile.hasPaidRegistrationFee && dueCents > 0,
    dueCents,
    dueError: dueError ?? null,
    pricingMode: profile.registrationFeePricingMode,
  });
}
