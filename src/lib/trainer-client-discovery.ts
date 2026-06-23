import type { Prisma } from "@/generated/prisma/client";
import { isTrainerComplianceComplete, type TrainerComplianceProfileFields } from "@/lib/trainer-compliance-complete";
import { fpDiscoveryTrustBadge, fpTierBadgeLabel } from "@/lib/fp-discovery-trust";
import { isFpListingVisibleInDiscovery } from "@/lib/fp-fithub-access";
import { isFpAccountTier } from "@/lib/fp-account-tier-types";

export const TRAINER_VERIFICATION_IN_PROGRESS_CLIENT_MESSAGE =
  "This coach is finishing verification. You can chat now — booking unlocks when they're verified.";

export type TrainerDiscoveryProfileFields = TrainerComplianceProfileFields & {
  hasSignedTOS: boolean;
  limitedDashboardUnlockedAt?: Date | string | null;
  dashboardActivatedAt?: Date | string | null;
  accountTier?: string | null;
  listingStatus?: string | null;
};

export function isTrainerPreVerifiedForClientDiscovery(
  prof: Pick<
    TrainerDiscoveryProfileFields,
    "hasSignedTOS" | "limitedDashboardUnlockedAt" | "dashboardActivatedAt"
  > | null | undefined,
): boolean {
  if (!prof?.hasSignedTOS || prof.limitedDashboardUnlockedAt == null) return false;
  return prof.dashboardActivatedAt == null;
}

export function isTrainerBookableForClients(
  prof: TrainerDiscoveryProfileFields | null | undefined,
): boolean {
  if (!prof || prof.dashboardActivatedAt == null) return false;
  return isTrainerComplianceComplete(prof);
}

/** Visible in browse, swipe, scroll, saved coaches, and public profile (chat allowed). */
export function isTrainerVisibleInClientDiscovery(
  prof: TrainerDiscoveryProfileFields | null | undefined,
): boolean {
  if (!prof) return false;
  if (prof.accountTier && !isFpListingVisibleInDiscovery({
    accountTier: prof.accountTier,
    listingStatus: prof.listingStatus ?? "active",
  })) {
    return false;
  }
  return isTrainerBookableForClients(prof) || isTrainerPreVerifiedForClientDiscovery(prof);
}

export type TrainerVerificationBadge = "verified" | "verification_in_progress";

export type TrainerFpTrustBadge = {
  label: string;
  emoji: string;
  tierBadge: string | null;
};

export function trainerFpTrustBadgeForClient(
  prof: Pick<TrainerDiscoveryProfileFields, "accountTier"> | null | undefined,
): TrainerFpTrustBadge | null {
  if (!prof?.accountTier || !isFpAccountTier(prof.accountTier)) return null;
  const trust = fpDiscoveryTrustBadge(prof.accountTier);
  if (!trust) return null;
  return {
    label: trust.label,
    emoji: trust.emoji,
    tierBadge: fpTierBadgeLabel(prof.accountTier),
  };
}

export function trainerVerificationBadgeForClient(
  prof: TrainerDiscoveryProfileFields | null | undefined,
): TrainerVerificationBadge | null {
  if (!isTrainerVisibleInClientDiscovery(prof)) return null;
  if (isTrainerBookableForClients(prof)) return "verified";
  if (isTrainerPreVerifiedForClientDiscovery(prof)) return "verification_in_progress";
  return null;
}

export function trainerBookableBlockedMessage(
  prof: TrainerDiscoveryProfileFields | null | undefined,
): string | null {
  if (isTrainerBookableForClients(prof)) return null;
  if (isTrainerPreVerifiedForClientDiscovery(prof)) {
    return TRAINER_VERIFICATION_IN_PROGRESS_CLIENT_MESSAGE;
  }
  return null;
}

/** Prisma filter: trainers visible on client discovery surfaces (pre-verified + fully activated). */
export function clientDiscoveryVisibleTrainerProfileWhere(): {
  is: Prisma.TrainerProfileWhereInput;
} {
  return {
    is: {
      hasSignedTOS: true,
      limitedDashboardUnlockedAt: { not: null },
    },
  };
}

export const trainerDiscoveryProfileSelect = {
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
  accountTier: true,
  listingStatus: true,
} as const;
