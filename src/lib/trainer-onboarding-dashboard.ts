import { prisma } from "@/lib/prisma";
import { certificationsGatePassed } from "@/lib/trainer-onboarding-cert-gate";
import { hasTrainerFullPlatformAccess, type TrainerAccessProfile } from "@/lib/trainer-full-access";
import { syncTrainerComplianceWindow } from "@/lib/trainer-compliance-window-sync";

/**
 * When full platform access is granted (cert + BG + W-9 + captured signup fee), mark the trainer live for clients.
 */
export async function maybeActivateTrainerDashboard(trainerId: string): Promise<void> {
  await syncTrainerComplianceWindow(trainerId);

  const prof = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      dashboardActivatedAt: true,
      hasSignedTOS: true,
      hasUploadedW9: true,
      backgroundCheckStatus: true,
      backgroundCheckClearedAt: true,
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      onboardingTrackSpecialist: true,
      certificationReviewStatus: true,
      nutritionistCertificationReviewStatus: true,
      specialistCertificationReviewStatus: true,
      limitedDashboardUnlockedAt: true,
      registrationFeeHoldStatus: true,
      hasPaidRegistrationFee: true,
      complianceWindowExpiredAt: true,
      complianceWindowStartedAt: true,
      complianceWindowPausedAt: true,
      complianceCertReuploadDeadlineAt: true,
      complianceHumanReviewDeadlineAt: true,
      complianceCertFailedAttempts: true,
      checkrReportId: true,
      fitHubPromoEndsAt: true,
    },
  });
  if (!prof || prof.dashboardActivatedAt) return;

  if (!hasTrainerFullPlatformAccess(prof as TrainerAccessProfile)) return;

  const bgOk = prof.backgroundCheckStatus === "APPROVED";
  if (prof.hasSignedTOS && prof.hasUploadedW9 && bgOk && certificationsGatePassed(prof)) {
    await prisma.trainerProfile.update({
      where: { trainerId },
      data: { dashboardActivatedAt: new Date() },
    });
  }
}
