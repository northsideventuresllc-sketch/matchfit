import { prisma } from "@/lib/prisma";

export async function isTrainerPremiumStudioActive(trainerId: string): Promise<boolean> {
  const row = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      premiumStudioEnabledAt: true,
      launchPremiumEndsAt: true,
      trainer: { select: { launchCohortMember: true } },
    },
  });
  if (!row?.premiumStudioEnabledAt) return false;
  if (row.trainer.launchCohortMember && row.launchPremiumEndsAt) {
    return row.launchPremiumEndsAt.getTime() > Date.now();
  }
  return true;
}
