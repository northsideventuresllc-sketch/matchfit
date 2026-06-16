import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotion-caps";
import { trainerBackgroundCheckAmountCents } from "@/lib/trainer-background-check-fee";
import { TRAINER_PLATFORM_REGISTRATION_FEE_CENTS } from "@/lib/trainer-platform-registration-fee";

export type TrainerSignupEscrowSplit = {
  backgroundCheckEscrowCents: number;
  platformEscrowCents: number;
  baseCents: number;
};

/** How signup authorization splits between Checkr escrow and platform fee (base only, before processing). */
export function computeTrainerSignupEscrowSplit(
  pricingMode: TrainerRegistrationPricingMode,
): TrainerSignupEscrowSplit {
  const bg = trainerBackgroundCheckAmountCents();
  if (
    pricingMode === "FOUNDING_BG_COVERED" ||
    pricingMode === "FOUNDING_BG_SURCHARGE_20PCT"
  ) {
    const platform = Math.max(1, Math.round(bg * 0.2));
    return {
      backgroundCheckEscrowCents: 0,
      platformEscrowCents: platform,
      baseCents: platform,
    };
  }
  const platform = Math.max(0, TRAINER_PLATFORM_REGISTRATION_FEE_CENTS - bg);
  return {
    backgroundCheckEscrowCents: bg,
    platformEscrowCents: platform,
    baseCents: TRAINER_PLATFORM_REGISTRATION_FEE_CENTS,
  };
}
