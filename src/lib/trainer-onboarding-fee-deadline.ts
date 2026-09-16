export const TRAINER_ONBOARDING_FEE_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;

export type TrainerOnboardingFeeDeadlineProfile = {
  onboardingFeePaymentDeadlineAt?: Date | string | null;
  registrationFeeHoldStatus?: string | null;
  hasPaidRegistrationFee?: boolean;
  /**
   * Platform waived the onboarding fee outright (e.g. founding BG-covered cohort — see
   * `syncFoundingBgCoveredTrainerPricingModes` in `trainer-founding-bg-covered.ts`). Nothing is
   * ever owed, so there is no Stripe hold/capture to reach — added 2026-09-15 after confirming
   * live that every founding trainer stuck on this deadline had `registrationFeeWaived: true`
   * and nothing to pay: without this check, `trainerOnboardingFeeIsPaid` never became true for
   * them and `isTrainerOnboardingFeePaymentOverdue` fired on schedule regardless.
   */
  registrationFeeWaived?: boolean;
};

export function trainerOnboardingFeeDeadlineAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRAINER_ONBOARDING_FEE_DEADLINE_MS);
}

export function trainerOnboardingFeeIsPaid(prof: TrainerOnboardingFeeDeadlineProfile | null | undefined): boolean {
  if (!prof) return false;
  if (prof.hasPaidRegistrationFee) return true;
  if (prof.registrationFeeWaived) return true;
  const hold = (prof.registrationFeeHoldStatus ?? "NOT_STARTED").trim().toUpperCase();
  return hold === "HELD" || hold === "CAPTURED" || hold === "DEFERRED";
}

/** True only when the platform onboarding fee was captured, waived, or explicitly marked paid (not merely held). */
export function trainerOnboardingFeeIsCaptured(
  prof: TrainerOnboardingFeeDeadlineProfile | null | undefined,
): boolean {
  if (!prof) return false;
  if (prof.hasPaidRegistrationFee) return true;
  if (prof.registrationFeeWaived) return true;
  const hold = (prof.registrationFeeHoldStatus ?? "NOT_STARTED").trim().toUpperCase();
  return hold === "CAPTURED";
}

export function isTrainerOnboardingFeePaymentOverdue(
  prof: TrainerOnboardingFeeDeadlineProfile | null | undefined,
  now = new Date(),
): boolean {
  if (!prof || trainerOnboardingFeeIsPaid(prof)) return false;
  const deadlineRaw = prof.onboardingFeePaymentDeadlineAt;
  if (!deadlineRaw) return false;
  const deadline = typeof deadlineRaw === "string" ? new Date(deadlineRaw) : deadlineRaw;
  if (Number.isNaN(deadline.getTime())) return false;
  return now.getTime() > deadline.getTime();
}

export function trainerOnboardingFeeDaysRemaining(
  prof: TrainerOnboardingFeeDeadlineProfile | null | undefined,
  now = new Date(),
): number | null {
  if (!prof || trainerOnboardingFeeIsPaid(prof)) return null;
  const deadlineRaw = prof.onboardingFeePaymentDeadlineAt;
  if (!deadlineRaw) return null;
  const deadline = typeof deadlineRaw === "string" ? new Date(deadlineRaw) : deadlineRaw;
  if (Number.isNaN(deadline.getTime())) return null;
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
