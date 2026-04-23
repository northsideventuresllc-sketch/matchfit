import { prisma } from "@/lib/prisma";

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
      certificationReviewStatus: true,
    },
  });
  if (!prof || prof.dashboardActivatedAt) return;
  const bgOk = prof.backgroundCheckStatus === "APPROVED";
  const cptOk = prof.certificationReviewStatus === "APPROVED";
  if (prof.hasSignedTOS && prof.hasUploadedW9 && bgOk && cptOk) {
    await prisma.trainerProfile.update({
      where: { trainerId },
      data: { dashboardActivatedAt: new Date() },
    });
  }
}
