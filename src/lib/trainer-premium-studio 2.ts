import { prisma } from "@/lib/prisma";

export async function isTrainerPremiumStudioActive(trainerId: string): Promise<boolean> {
  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { premiumStudioEnabledAt: true },
  });
  return Boolean(profile?.premiumStudioEnabledAt);
}
