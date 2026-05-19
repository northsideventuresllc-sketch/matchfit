import { prisma } from "@/lib/prisma";

/** Permanently block onboarding and exclude from public counts after human denial. */
export async function denyTrainerBackgroundCheck(trainerId: string, reason?: string): Promise<void> {
  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { email: true, deidentifiedAt: true },
  });
  if (!trainer || trainer.deidentifiedAt) return;

  const email = trainer.email.trim().toLowerCase();
  const now = new Date();

  await prisma.$transaction([
    prisma.trainerProfile.update({
      where: { trainerId },
      data: {
        backgroundCheckStatus: "DENIED",
        backgroundCheckReviewStatus: "DENIED",
        backgroundCheckClearedAt: null,
      },
    }),
    prisma.trainerOnboardingDenial.upsert({
      where: { email },
      create: { email, trainerId, reason: reason ?? "Background check denied after human review." },
      update: { trainerId, reason: reason ?? "Background check denied after human review." },
    }),
    prisma.trainer.update({
      where: { id: trainerId },
      data: { deidentifiedAt: now },
    }),
  ]);
}

export async function approveTrainerBackgroundCheckHumanReview(trainerId: string): Promise<void> {
  const clearedAt = new Date();
  await prisma.trainerProfile.update({
    where: { trainerId },
    data: {
      backgroundCheckStatus: "APPROVED",
      backgroundCheckReviewStatus: "APPROVED",
      backgroundCheckClearedAt: clearedAt,
      backgroundCheckExpiryWarningSentAt: null,
    },
  });

  const { maybeActivateTrainerDashboard } = await import("@/lib/trainer-onboarding-dashboard");
  await maybeActivateTrainerDashboard(trainerId);
}

export async function isTrainerEmailBlockedFromRegistration(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const denial = await prisma.trainerOnboardingDenial.findUnique({ where: { email: normalized } });
  return Boolean(denial);
}
