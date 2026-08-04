import {
  isTrainerOnboardingFeePaymentOverdue,
  trainerOnboardingFeeIsPaid,
} from "@/lib/trainer-onboarding-fee-deadline";
import { isFpAccountTier } from "@/lib/fp-account-tier-types";

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

/**
 * Post-auth routing: credentials → terms → tier → dashboard.
 *
 * Documents used to sit between the tier step and the dashboard, which meant a new Fitness Pro
 * could not reach their own dashboard at all — every tier requires at least one document, so the
 * docs redirect always fired. Uploading certifications and completing the background check are
 * now tasks ON the dashboard (JB, 2026-08-04) rather than gates in front of it. The onboarding
 * fee deadline is still enforced below: that is a real, dated commitment, not a setup step.
 */
export function resolveTrainerSignupNextPath(prof: TrainerSignupProgressProfile | null | undefined): string {
  if (!prof?.hasSignedTOS) return "/trainer/signup/terms";
  if (!prof.accountTier || !isFpAccountTier(prof.accountTier)) return "/trainer/signup/tier";
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
