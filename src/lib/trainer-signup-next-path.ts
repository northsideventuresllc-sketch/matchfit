import {
  isTrainerOnboardingFeePaymentOverdue,
  trainerOnboardingFeeIsPaid,
} from "@/lib/trainer-onboarding-fee-deadline";
import { isFpAccountTier } from "@/lib/fp-account-tier-types";
import { fpRequiredDocsForTier } from "@/lib/fp-tier-docs";

export type TrainerSignupProgressProfile = {
  hasSignedTOS: boolean;
  accountTier?: string | null;
  docsSubmitted?: boolean;
  docsApproved?: boolean;
  registrationFeeHoldStatus?: string | null;
  hasPaidRegistrationFee?: boolean;
  limitedDashboardUnlockedAt?: Date | string | null;
  onboardingFeePaymentDeadlineAt?: Date | string | null;
  onboardingFeePaymentExpiredAt?: Date | string | null;
};

/** Post-auth routing: credentials → terms → tier → docs → payment → dashboard. */
export function resolveTrainerSignupNextPath(prof: TrainerSignupProgressProfile | null | undefined): string {
  if (!prof?.hasSignedTOS) return "/trainer/signup/terms";
  if (!prof.accountTier || !isFpAccountTier(prof.accountTier)) return "/trainer/signup/tier";
  const requiredDocs = fpRequiredDocsForTier(prof.accountTier);
  if (requiredDocs.length > 0 && !prof.docsSubmitted) return "/trainer/signup/docs";
  if (prof.onboardingFeePaymentExpiredAt) {
    return "/trainer/signup/payment";
  }
  if (isTrainerOnboardingFeePaymentOverdue(prof)) {
    return "/trainer/signup/payment";
  }
  if (trainerOnboardingFeeIsPaid(prof)) {
    return "/trainer/dashboard";
  }
  if (prof.limitedDashboardUnlockedAt) {
    return "/trainer/dashboard";
  }
  return "/trainer/signup/payment";
}
