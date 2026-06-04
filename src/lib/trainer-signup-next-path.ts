export type TrainerSignupProgressProfile = {
  hasSignedTOS: boolean;
  registrationFeeHoldStatus?: string | null;
  hasPaidRegistrationFee?: boolean;
  limitedDashboardUnlockedAt?: Date | string | null;
};

/** Post-auth routing: basic account → terms → held payment → limited dashboard. */
export function resolveTrainerSignupNextPath(prof: TrainerSignupProgressProfile | null | undefined): string {
  if (!prof?.hasSignedTOS) return "/trainer/signup/terms";
  const hold = (prof.registrationFeeHoldStatus ?? "NOT_STARTED").trim().toUpperCase();
  const paid =
    prof.hasPaidRegistrationFee ||
    hold === "HELD" ||
    hold === "CAPTURED" ||
    Boolean(prof.limitedDashboardUnlockedAt);
  if (!paid) return "/trainer/signup/payment";
  return "/trainer/dashboard";
}
