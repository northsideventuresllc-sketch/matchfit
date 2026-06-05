import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotion-caps";
import { computeCheckoutFeeBreakdown } from "@/lib/stripe-checkout-line-items";
import { estimateStripeProcessingFeeCents } from "@/lib/stripe-processing-fee";
import {
  computeTrainerSignupEscrowSplit,
} from "@/lib/trainer-signup-escrow-split";

export type { TrainerSignupEscrowSplit } from "@/lib/trainer-signup-escrow-split";
export { computeTrainerSignupEscrowSplit } from "@/lib/trainer-signup-escrow-split";

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
