import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotions";
import { trainerBackgroundCheckAmountCents } from "@/lib/trainer-background-check-stripe";
import { TRAINER_PLATFORM_REGISTRATION_FEE_CENTS } from "@/lib/trainer-registration-fee";
import { computeCheckoutFeeBreakdown } from "@/lib/stripe-checkout-line-items";
import { estimateStripeProcessingFeeCents } from "@/lib/stripe-processing-fee";

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
  if (pricingMode === "FOUNDING_BG_SURCHARGE_20PCT") {
    const platform = Math.max(1, Math.round(bg * 0.2));
    return {
      backgroundCheckEscrowCents: bg,
      platformEscrowCents: platform,
      baseCents: bg + platform,
    };
  }
  const platform = Math.max(0, TRAINER_PLATFORM_REGISTRATION_FEE_CENTS - bg);
  return {
    backgroundCheckEscrowCents: bg,
    platformEscrowCents: platform,
    baseCents: TRAINER_PLATFORM_REGISTRATION_FEE_CENTS,
  };
}

/** Stripe capture amount when background screening never clears (platform + its processing share only). */
export function computeTrainerSignupCaptureOnBgFailureCents(
  pricingMode: TrainerRegistrationPricingMode,
): number {
  const split = computeTrainerSignupEscrowSplit(pricingMode);
  const platformProcessing = estimateStripeProcessingFeeCents(split.platformEscrowCents);
  return split.platformEscrowCents + platformProcessing;
}

/** Full capture when certification + background check are approved. */
export function computeTrainerSignupCaptureOnSuccessCents(
  pricingMode: TrainerRegistrationPricingMode,
): number {
  const split = computeTrainerSignupEscrowSplit(pricingMode);
  return computeCheckoutFeeBreakdown({
    baseCents: split.baseCents,
    includeAdminFee: false,
    includeProcessingFee: true,
  }).totalChargedCents;
}

export function signupEscrowMetadata(
  pricingMode: TrainerRegistrationPricingMode,
): Record<string, string> {
  const split = computeTrainerSignupEscrowSplit(pricingMode);
  return {
    backgroundCheckEscrowCents: String(split.backgroundCheckEscrowCents),
    platformEscrowCents: String(split.platformEscrowCents),
    captureOnSuccessCents: String(computeTrainerSignupCaptureOnSuccessCents(pricingMode)),
    captureOnBgFailureCents: String(computeTrainerSignupCaptureOnBgFailureCents(pricingMode)),
  };
}
