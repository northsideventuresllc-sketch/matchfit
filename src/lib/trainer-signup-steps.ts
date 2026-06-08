export const TRAINER_SIGNUP_STEP_COUNT = 3;

export type TrainerSignupStepId = 1 | 2 | 3;

export type TrainerSignupStep = {
  id: TrainerSignupStepId;
  href: string;
  title: string;
  shortLabel: string;
};

export const TRAINER_SIGNUP_STEPS: readonly TrainerSignupStep[] = [
  { id: 1, href: "/trainer/signup", title: "Account details", shortLabel: "Account" },
  { id: 2, href: "/trainer/signup/terms", title: "Trainer agreement", shortLabel: "Agreement" },
  { id: 3, href: "/trainer/signup/payment", title: "Signup fee", shortLabel: "Payment" },
] as const;

export function trainerSignupStepById(id: TrainerSignupStepId): TrainerSignupStep {
  const step = TRAINER_SIGNUP_STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`Unknown trainer signup step: ${id}`);
  return step;
}
