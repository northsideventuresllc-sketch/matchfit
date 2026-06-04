import { prisma } from "@/lib/prisma";
import { trainerFitHubPromoActive, type TrainerAccessProfile } from "@/lib/trainer-full-access";
import { trainerFullAccessProfileSelect } from "@/lib/trainer-full-access-profile-select";

export async function isTrainerPremiumStudioActive(trainerId: string): Promise<boolean> {
  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      premiumStudioEnabledAt: true,
      fitHubPromoEndsAt: true,
      ...trainerFullAccessProfileSelect,
    },
  });
  if (!profile) return false;
  if (profile.premiumStudioEnabledAt) return true;
  return trainerFitHubPromoActive(profile as TrainerAccessProfile);
}
