import {
  isTrainerOnboardingFeePaymentOverdue,
  trainerOnboardingFeeIsPaid,
} from "@/lib/trainer-onboarding-fee-deadline";

export type TrainerSignupProgressProfile = {
  hasSignedTOS: boolean;
  registrationFeeHoldStatus?: string | null;
  hasPaidRegistrationFee?: boolean;
  limitedDashboardUnlockedAt?: Date | string | null;
  onboardingFeePaymentDeadlineAt?: Date | string | null;
  onboardingFeePaymentExpiredAt?: Date | string | null;
};

/** Post-auth routing: credentials → terms (account created) → dashboard with 7-day fee window. */
export function resolveTrainerSignupNextPath(prof: TrainerSignupProgressProfile | null | undefined): string {
  if (!prof?.hasSignedTOS) return "/trainer/signup/terms";
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
