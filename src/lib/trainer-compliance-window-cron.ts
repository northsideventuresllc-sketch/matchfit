import { prisma } from "@/lib/prisma";
import {
  evaluateTrainerComplianceWindow,
  type TrainerComplianceWindowProfile,
} from "@/lib/trainer-compliance-window";
import { expireTrainerComplianceWindow } from "@/lib/trainer-compliance-window-sync";

export async function processTrainerComplianceWindowExpirations(): Promise<number> {
  const rows = await prisma.trainerProfile.findMany({
    where: {
      complianceWindowStartedAt: { not: null },
      complianceWindowExpiredAt: null,
      limitedDashboardUnlockedAt: { not: null },
    },
    select: {
      trainerId: true,
      complianceWindowStartedAt: true,
      complianceWindowPausedAt: true,
      complianceCertReuploadDeadlineAt: true,
      complianceHumanReviewDeadlineAt: true,
      complianceCertFailedAttempts: true,
      complianceWindowExpiredAt: true,
      onboardingTrackCpt: true,
      onboardingTrackNutrition: true,
      onboardingTrackSpecialist: true,
      certificationReviewStatus: true,
      nutritionistCertificationReviewStatus: true,
      specialistCertificationReviewStatus: true,
      backgroundCheckStatus: true,
      checkrReportId: true,
    },
  });

  let expired = 0;
  const now = new Date();
  for (const row of rows) {
    const state = evaluateTrainerComplianceWindow(row as TrainerComplianceWindowProfile, now);
    if (state.expired) {
      await expireTrainerComplianceWindow(row.trainerId);
      expired += 1;
    }
  }
  return expired;
}
