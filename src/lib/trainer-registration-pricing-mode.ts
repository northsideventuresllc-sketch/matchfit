import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotion-caps";

/** Parse persisted profile pricing mode; legacy founding rows map to covered BG tier. */
export function parseTrainerRegistrationPricingMode(
  raw: string | null | undefined,
): TrainerRegistrationPricingMode {
  const v = (raw ?? "").trim().toUpperCase();
  if (v === "STANDARD_100_MINUS_BG") return "STANDARD_100_MINUS_BG";
  if (v === "FOUNDING_BG_COVERED") return "FOUNDING_BG_COVERED";
  if (v === "FOUNDING_BG_SURCHARGE_20PCT") return "FOUNDING_BG_COVERED";
  if (v === "BETA_DISCOUNTED") return "BETA_DISCOUNTED";
  return "FOUNDING_BG_COVERED";
}

/** First-N founding coaches whose Checkr screening is paid by Match Fit. */
export function isTrainerBackgroundCheckPlatformCovered(
  pricingMode: TrainerRegistrationPricingMode,
): boolean {
  return pricingMode === "FOUNDING_BG_COVERED" || pricingMode === "FOUNDING_BG_SURCHARGE_20PCT";
}

/** Founding coach pricing (20% platform slice instead of full $100 minus BG). */
export function isTrainerFoundingCoachPricing(pricingMode: TrainerRegistrationPricingMode): boolean {
  return isTrainerBackgroundCheckPlatformCovered(pricingMode);
}

/** Whether signup should authorize a separate background-check Stripe hold. */
export function trainerSignupRequiresBackgroundEscrowHold(
  pricingMode: TrainerRegistrationPricingMode,
): boolean {
  return !isTrainerBackgroundCheckPlatformCovered(pricingMode);
}
