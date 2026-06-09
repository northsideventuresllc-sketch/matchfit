import { isBackgroundCheckPlanBActive, isCheckrApiFullyConfigured } from "@/lib/checkr-integration";

export type TrainerBackgroundCheckUiMode = "plan_b" | "checkr_api" | "unconfigured";

export function resolveTrainerBackgroundCheckUiMode(): TrainerBackgroundCheckUiMode {
  if (isBackgroundCheckPlanBActive()) return "plan_b";
  if (isCheckrApiFullyConfigured()) return "checkr_api";
  return "unconfigured";
}

/** Signup holds include a background-check escrow slice (split PI or legacy combined hold). */
export function trainerHasSignupBackgroundEscrow(args: {
  registrationFeeHoldStatus?: string | null;
  backgroundCheckEscrowHoldStatus?: string | null;
  backgroundCheckEscrowPaymentIntentId?: string | null;
  hasPaidBackgroundFee?: boolean;
}): boolean {
  if (args.hasPaidBackgroundFee) return true;
  const bgHold = (args.backgroundCheckEscrowHoldStatus ?? "").trim().toUpperCase();
  if (bgHold === "HELD" || bgHold === "CAPTURED") return true;
  const platformHold = (args.registrationFeeHoldStatus ?? "").trim().toUpperCase();
  if (
    (platformHold === "HELD" || platformHold === "CAPTURED") &&
    !args.backgroundCheckEscrowPaymentIntentId?.trim()
  ) {
    return true;
  }
  return false;
}
