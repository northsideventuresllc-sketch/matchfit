import type { Prisma } from "@/generated/prisma/client";
import { trainerOnboardingFeeIsPaid } from "@/lib/trainer-onboarding-fee-deadline";

export type TrainerMembershipStatus = "pre_tos" | "pending" | "active" | "deidentified";

export type TrainerMembershipProfile = {
  hasSignedTOS?: boolean | null;
  dashboardActivatedAt?: Date | string | null;
  complianceWindowStartedAt?: Date | string | null;
  limitedDashboardUnlockedAt?: Date | string | null;
  registrationFeeHoldStatus?: string | null;
  hasPaidRegistrationFee?: boolean | null;
};

export type TrainerMembershipTrainer = {
  termsAcceptedAt?: Date | string | null;
  deidentifiedAt?: Date | string | null;
};

export function resolveTrainerMembershipStatus(input: {
  trainer?: TrainerMembershipTrainer | null;
  profile?: TrainerMembershipProfile | null;
}): TrainerMembershipStatus {
  if (input.trainer?.deidentifiedAt) return "deidentified";

  const profile = input.profile;
  if (profile?.dashboardActivatedAt) return "active";

  const termsAccepted = Boolean(input.trainer?.termsAcceptedAt) || Boolean(profile?.hasSignedTOS);
  const onboardingStarted =
    termsAccepted ||
    Boolean(profile?.complianceWindowStartedAt) ||
    Boolean(profile?.limitedDashboardUnlockedAt) ||
    trainerOnboardingFeeIsPaid(
      profile
        ? {
            hasPaidRegistrationFee: profile.hasPaidRegistrationFee ?? undefined,
            registrationFeeHoldStatus: profile.registrationFeeHoldStatus ?? undefined,
            onboardingFeePaymentDeadlineAt: undefined,
          }
        : undefined,
    );

  if (onboardingStarted) return "pending";
  return "pre_tos";
}

export function trainerMembershipStatusLabel(status: TrainerMembershipStatus): string {
  if (status === "active") return "Active";
  if (status === "pending") return "Pending onboarding";
  if (status === "deidentified") return "Removed (deidentified)";
  return "Pre–Terms of Service";
}

export function buildAdminTrainerSearchClause(query: string): Prisma.TrainerWhereInput {
  const q = query.trim();
  if (!q) return {};

  return {
    OR: [
      { username: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { preferredName: { contains: q, mode: "insensitive" } },
    ],
  };
}

export function buildAdminClientSearchClause(query: string): Prisma.ClientWhereInput {
  const q = query.trim();
  if (!q) return {};

  return {
    OR: [
      { username: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { preferredName: { contains: q, mode: "insensitive" } },
    ],
  };
}

export type TrainerPendingQualifications = {
  termsAccepted: boolean;
  complianceWindowStarted: boolean;
  onboardingFeeCompleted: boolean;
  backgroundCheckStatus: string;
  backgroundCheckReviewStatus: string | null;
  documentsComplete: boolean;
  documentsPending: boolean;
};

export function buildTrainerPendingQualifications(input: {
  termsAcceptedAt?: Date | string | null;
  profile?: {
    hasSignedTOS?: boolean | null;
    complianceWindowStartedAt?: Date | string | null;
    hasPaidRegistrationFee?: boolean | null;
    registrationFeeHoldStatus?: string | null;
    backgroundCheckStatus?: string | null;
    backgroundCheckReviewStatus?: string | null;
    certificationUrl?: string | null;
    nutritionistCertificationUrl?: string | null;
    specialistCertificationUrl?: string | null;
    otherCertificationUrl?: string | null;
    certificationReviewStatus?: string | null;
    nutritionistCertificationReviewStatus?: string | null;
    specialistCertificationReviewStatus?: string | null;
    otherCertificationReviewStatus?: string | null;
  } | null;
}): TrainerPendingQualifications {
  const p = input.profile;
  const termsAccepted = Boolean(input.termsAcceptedAt) || Boolean(p?.hasSignedTOS);
  const hasDocs =
    Boolean(p?.certificationUrl) ||
    Boolean(p?.nutritionistCertificationUrl) ||
    Boolean(p?.specialistCertificationUrl) ||
    Boolean(p?.otherCertificationUrl);
  const allApproved =
    (!p?.certificationUrl || p.certificationReviewStatus === "APPROVED") &&
    (!p?.nutritionistCertificationUrl || p.nutritionistCertificationReviewStatus === "APPROVED") &&
    (!p?.specialistCertificationUrl || p.specialistCertificationReviewStatus === "APPROVED") &&
    (!p?.otherCertificationUrl || p.otherCertificationReviewStatus === "APPROVED");

  return {
    termsAccepted,
    complianceWindowStarted: Boolean(p?.complianceWindowStartedAt),
    onboardingFeeCompleted:
      Boolean(p?.hasPaidRegistrationFee) ||
      p?.registrationFeeHoldStatus === "HELD" ||
      p?.registrationFeeHoldStatus === "CAPTURED",
    backgroundCheckStatus: p?.backgroundCheckStatus ?? "NOT_STARTED",
    backgroundCheckReviewStatus: p?.backgroundCheckReviewStatus ?? null,
    documentsComplete: hasDocs && allApproved,
    documentsPending: hasDocs && !allApproved,
  };
}
