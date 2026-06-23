import { prisma } from "@/lib/prisma";
import { trainerFitHubPromoActive, type TrainerAccessProfile } from "@/lib/trainer-full-access";
import { trainerFullAccessProfileSelect } from "@/lib/trainer-full-access-profile-select";
import { hasFpFitHubAccess } from "@/lib/fp-fithub-access";

export async function isTrainerPremiumStudioActive(trainerId: string): Promise<boolean> {
  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: {
      premiumStudioEnabledAt: true,
      accountTier: true,
      listingStatus: true,
      ...trainerFullAccessProfileSelect,
    },
  });
  if (!profile) return false;
  if (hasFpFitHubAccess(profile)) return true;
  if (profile.premiumStudioEnabledAt) return true;
  return trainerFitHubPromoActive(profile as TrainerAccessProfile);
}
