export const TRAINER_SIGNUP_STEP_COUNT = 5;

export type TrainerSignupStepId = 1 | 2 | 3 | 4 | 5;

export type TrainerSignupStep = {
  id: TrainerSignupStepId;
  href: string;
  title: string;
  shortLabel: string;
};

export const TRAINER_SIGNUP_STEPS: readonly TrainerSignupStep[] = [
  { id: 1, href: "/trainer/signup", title: "Account details", shortLabel: "Account" },
  { id: 2, href: "/trainer/signup/terms", title: "Fitness Pro agreement", shortLabel: "Agreement" },
  { id: 3, href: "/trainer/signup/tier", title: "Choose your path", shortLabel: "Account type" },
  { id: 4, href: "/trainer/signup/docs", title: "Required documents", shortLabel: "Documents" },
  { id: 5, href: "/trainer/signup/payment", title: "Signup fee", shortLabel: "Payment" },
] as const;

export function trainerSignupStepById(id: TrainerSignupStepId): TrainerSignupStep {
  const step = TRAINER_SIGNUP_STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`Unknown trainer signup step: ${id}`);
  return step;
}
