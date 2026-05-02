import { prisma } from "@/lib/prisma";
import { certificationsGatePassed } from "@/lib/trainer-onboarding-cert-gate";

/**
 * When compliance + onboarding profile are complete, mark the trainer dashboard as activated once.
 */
export async function maybeActivateTrainerDashboard(trainerId: string): Promise<void> {
  const prof = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      dashboardActivatedAt: true,
      hasSignedTOS: true,
      hasUploadedW9: true,
      backgroundCheckStatus: true,
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      onboardingTrackSpecialist: true,
      certificationReviewStatus: true,
      nutritionistCertificationReviewStatus: true,
      specialistCertificationReviewStatus: true,
    },
  });
  if (!prof || prof.dashboardActivatedAt) return;
  const bgOk = prof.backgroundCheckStatus === "APPROVED";
  if (prof.hasSignedTOS && prof.hasUploadedW9 && bgOk && certificationsGatePassed(prof)) {
    await prisma.trainerProfile.update({
      where: { trainerId },
      data: { dashboardActivatedAt: new Date() },
    });
  }
}
