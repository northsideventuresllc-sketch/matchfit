/** Development-only bypass for trainer onboarding QA (case-sensitive). */
export const TRAINER_ONBOARDING_DEV_PASSWORD = "Crumpet99!" as const;

export function verifyTrainerOnboardingDevPassword(input: string | undefined | null): boolean {
  return input === TRAINER_ONBOARDING_DEV_PASSWORD;
}
