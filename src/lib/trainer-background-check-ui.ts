import { isBackgroundCheckPlanBActive, isCheckrApiFullyConfigured } from "@/lib/checkr-integration";

export type TrainerBackgroundCheckUiMode = "plan_b" | "checkr_api" | "unconfigured";

export function resolveTrainerBackgroundCheckUiMode(): TrainerBackgroundCheckUiMode {
  if (isBackgroundCheckPlanBActive()) return "plan_b";
  if (isCheckrApiFullyConfigured()) return "checkr_api";
  return "unconfigured";
}

/** Signup fee hold includes a background-check escrow slice (no separate Stripe BG charge). */
export function trainerHasSignupBackgroundEscrow(args: {
  registrationFeeHoldStatus?: string | null;
  hasPaidBackgroundFee?: boolean;
}): boolean {
  const hold = (args.registrationFeeHoldStatus ?? "").trim().toUpperCase();
  if (hold === "HELD" || hold === "CAPTURED") return true;
  return Boolean(args.hasPaidBackgroundFee);
}
