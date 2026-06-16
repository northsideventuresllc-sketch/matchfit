import {
  getTrainerFoundingBgCoveredMax,
  type TrainerRegistrationPricingMode,
} from "@/lib/match-fit-launch-promotion-caps";

import { TRAINER_PLATFORM_REGISTRATION_FEE_CENTS } from "@/lib/trainer-platform-registration-fee";

export { TRAINER_PLATFORM_REGISTRATION_FEE_CENTS } from "@/lib/trainer-platform-registration-fee";

export function trainerRegistrationPricingModeForNewTrainer(
  trainerCountBeforeInsert: number,
): TrainerRegistrationPricingMode {
  return trainerCountBeforeInsert < getTrainerFoundingBgCoveredMax()
    ? "FOUNDING_BG_COVERED"
    : "STANDARD_100_MINUS_BG";
}

/**
 * Amount due to Match Fit at registration checkout (cents), excluding processing fee line.
 * - Founding: 20% of verified Checkr/vendor background amount.
 * - Standard: $100 minus amount paid to Checkr (floored at 0).
 */
export function computeTrainerRegistrationDueCents(args: {
  pricingMode: TrainerRegistrationPricingMode;
  backgroundCheckVendorPaidCents: number;
}): { dueCents: number; error?: string } {
  const bg = Math.max(0, Math.floor(args.backgroundCheckVendorPaidCents));
  if (bg <= 0) {
    return { dueCents: 0, error: "Background check payment amount is not recorded yet." };
  }
  if (args.pricingMode === "FOUNDING_BG_COVERED" || args.pricingMode === "FOUNDING_BG_SURCHARGE_20PCT") {
    const due = Math.max(1, Math.round(bg * 0.2));
    return { dueCents: due };
  }
  const due = Math.max(0, TRAINER_PLATFORM_REGISTRATION_FEE_CENTS - bg);
  if (due <= 0) {
    return {
      dueCents: 0,
      error: "No platform registration balance is due after your background check credit.",
    };
  }
  return { dueCents: due };
}
