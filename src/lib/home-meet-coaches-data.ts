import { launchTrainerCountWhere } from "@/lib/launch-account-counts";
import { publicMarketplaceVisibleTrainerWhere } from "@/lib/match-fit-public-marketplace-hidden";
import {
  clientDiscoveryVisibleTrainerProfileWhere,
  isTrainerVisibleInClientDiscovery,
  trainerVerificationBadgeForClient,
  type TrainerVerificationBadge,
} from "@/lib/trainer-client-discovery";
import { formatTrainerServiceZipLabel } from "@/lib/trainer-service-zip";
import { prisma } from "@/lib/prisma";

export type MeetOurCoachCard = {
  username: string;
  firstName: string;
  specialtyLine: string;
  regionLabel: string | null;
  profileImageUrl: string | null;
  verificationBadge: TrainerVerificationBadge;
  profileHref: string;
};

function specialtyLine(fitnessNiches: string | null, bio: string | null): string {
  const n = fitnessNiches?.trim();
  if (n) return n.length > 80 ? `${n.slice(0, 77)}…` : n;
  const b = bio?.trim();
  if (b) return b.length > 80 ? `${b.slice(0, 77)}…` : b;
  return "Personal training";
}

export async function getMeetOurCoachesForHomepage(limit = 8): Promise<MeetOurCoachCard[]> {
  const rows = await prisma.trainer.findMany({
    where: {
      ...publicMarketplaceVisibleTrainerWhere(),
      ...launchTrainerCountWhere(),
      profile: clientDiscoveryVisibleTrainerProfileWhere(),
    },
    orderBy: [
      { profile: { dashboardActivatedAt: "desc" } },
      { profile: { limitedDashboardUnlockedAt: "desc" } },
      { createdAt: "desc" },
    ],
    take: Math.max(limit * 3, limit),
    select: {
      username: true,
      firstName: true,
      bio: true,
      fitnessNiches: true,
      profileImageUrl: true,
      profile: {
        select: {
          dashboardActivatedAt: true,
          limitedDashboardUnlockedAt: true,
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
          serviceZipCode: true,
        },
      },
    },
  });

  const cards: MeetOurCoachCard[] = [];
  for (const t of rows) {
    const prof = t.profile;
    if (!prof || !isTrainerVisibleInClientDiscovery(prof)) continue;
    const badge = trainerVerificationBadgeForClient(prof);
    if (!badge) continue;
    const first = t.firstName.trim() || "Coach";
    cards.push({
      username: t.username,
      firstName: first,
      specialtyLine: specialtyLine(t.fitnessNiches, t.bio),
      regionLabel: formatTrainerServiceZipLabel(prof.serviceZipCode),
      profileImageUrl: t.profileImageUrl,
      verificationBadge: badge,
      profileHref: `/trainers/${encodeURIComponent(t.username)}`,
    });
    if (cards.length >= limit) break;
  }
  return cards;
}
