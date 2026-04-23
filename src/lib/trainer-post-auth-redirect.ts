export const TRAINER_POST_AUTH_PATHS = ["/trainer/dashboard", "/trainer/onboarding"] as const;

export type TrainerPostAuthPath = (typeof TRAINER_POST_AUTH_PATHS)[number];

export function normalizeTrainerPostAuthPath(input: unknown): TrainerPostAuthPath | undefined {
  if (input === "/trainer/dashboard" || input === "/trainer/onboarding") {
    return input;
  }
  return undefined;
}
