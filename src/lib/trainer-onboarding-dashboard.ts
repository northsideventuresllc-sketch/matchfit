import { prisma } from "@/lib/prisma";
import { certificationsGatePassed } from "@/lib/trainer-onboarding-cert-gate";
import { hasTrainerFullPlatformAccess, type TrainerAccessProfile } from "@/lib/trainer-full-access";
import { syncTrainerComplianceWindow } from "@/lib/trainer-compliance-window-sync";
import { syncFpListingStatusForCompliance } from "@/lib/fp-listing-status-sync";

/**
 * When full platform access is granted (cert + BG + W-9 + captured signup fee), mark the trainer live for clients.
 */
export async function maybeActivateTrainerDashboard(trainerId: string): Promise<void> {
  await syncTrainerComplianceWindow(trainerId);

  // Run on every call, even when the dashboard was already activated earlier — this is the only
  // hook that fires after a LATE-clearing background check (e.g. the Checkr webhook), so it must
  // not be skipped by the dashboardActivatedAt short-circuit below. Idempotent: no-op once
  // listingStatus already matches what compliance allows.
  await syncFpListingStatusForCompliance(trainerId);

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
