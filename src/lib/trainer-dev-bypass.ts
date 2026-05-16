/**
 * Local development-only bypass for trainer onboarding screens (never active in production).
 * Prefer `MATCH_FIT_INTERNAL_QA_*` + account password for owner QA accounts in production.
 */
export function verifyTrainerOnboardingDevPassword(input: string | undefined | null): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const expected = process.env.MATCH_FIT_TRAINER_ONBOARDING_DEV_PASSWORD?.trim();
  if (!expected) return false;
  return input === expected;
}
