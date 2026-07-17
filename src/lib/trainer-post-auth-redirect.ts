export const TRAINER_POST_AUTH_PATHS = [
  "/trainer/dashboard",
  "/trainer/onboarding",
  "/trainer/dashboard/billing?locked=1",
] as const;

export type TrainerPostAuthPath = (typeof TRAINER_POST_AUTH_PATHS)[number];

export function normalizeTrainerPostAuthPath(input: unknown): TrainerPostAuthPath | undefined {
  if (
    input === "/trainer/dashboard" ||
    input === "/trainer/onboarding" ||
    input === "/trainer/dashboard/billing?locked=1"
  ) {
    return input;
  }
  return undefined;
}
