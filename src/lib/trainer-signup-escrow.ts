import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotion-caps";
import { computeCheckoutFeeBreakdown } from "@/lib/stripe-checkout-line-items";
import {
  computeTrainerSignupEscrowSplit,
} from "@/lib/trainer-signup-escrow-split";

export type { TrainerSignupEscrowSplit } from "@/lib/trainer-signup-escrow-split";
export { computeTrainerSignupEscrowSplit } from "@/lib/trainer-signup-escrow-split";

export type TrainerSignupEscrowProcessingSplit = {
  backgroundCheckProcessingCents: number;
  platformProcessingCents: number;
  totalProcessingCents: number;
};

/** Split the signup processing fee proportionally between background-check and platform slices. */
export function allocateTrainerSignupProcessingFees(
  pricingMode: TrainerRegistrationPricingMode,
): TrainerSignupEscrowProcessingSplit {
  const split = computeTrainerSignupEscrowSplit(pricingMode);
  const totalProcessingCents = computeCheckoutFeeBreakdown({
    baseCents: split.baseCents,
    includeAdminFee: false,
    includeProcessingFee: true,
  }).processingCents;
  if (split.baseCents <= 0 || totalProcessingCents <= 0) {
    return { backgroundCheckProcessingCents: 0, platformProcessingCents: 0, totalProcessingCents: 0 };
  }
  const bgShare = split.backgroundCheckEscrowCents / split.baseCents;
  const backgroundCheckProcessingCents = Math.round(totalProcessingCents * bgShare);
  const platformProcessingCents = Math.max(0, totalProcessingCents - backgroundCheckProcessingCents);
  return { backgroundCheckProcessingCents, platformProcessingCents, totalProcessingCents };
}

/** Amount to authorize/capture for the Checkr escrow PaymentIntent (background slice + processing share). */
export function computeTrainerSignupBackgroundEscrowHoldCents(
  pricingMode: TrainerRegistrationPricingMode,
): number {
  const split = computeTrainerSignupEscrowSplit(pricingMode);
  const processing = allocateTrainerSignupProcessingFees(pricingMode);
  return split.backgroundCheckEscrowCents + processing.backgroundCheckProcessingCents;
}

/** Amount to authorize/capture for the platform onboarding PaymentIntent (platform slice + processing share). */
export function computeTrainerSignupPlatformHoldCents(
  pricingMode: TrainerRegistrationPricingMode,
): number {
  const split = computeTrainerSignupEscrowSplit(pricingMode);
  const processing = allocateTrainerSignupProcessingFees(pricingMode);
  return split.platformEscrowCents + processing.platformProcessingCents;
}

/** Full capture when certification + background check are approved (legacy combined PaymentIntent). */
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

/** Combined authorization total for split signup holds (background + platform + processing). */
export function computeTrainerSignupCombinedHoldCents(
  pricingMode: TrainerRegistrationPricingMode,
): number {
  return (
    computeTrainerSignupBackgroundEscrowHoldCents(pricingMode) +
    computeTrainerSignupPlatformHoldCents(pricingMode)
  );
}

/**
 * @deprecated Legacy combined-intent failure path captured platform only. Split holds use
 * `releaseTrainerSignupPlatformHold` instead.
 */
export function computeTrainerSignupCaptureOnBgFailureCents(
  pricingMode: TrainerRegistrationPricingMode,
): number {
  return computeTrainerSignupPlatformHoldCents(pricingMode);
}

export function signupEscrowMetadata(
  pricingMode: TrainerRegistrationPricingMode,
): Record<string, string> {
  const split = computeTrainerSignupEscrowSplit(pricingMode);
  const processing = allocateTrainerSignupProcessingFees(pricingMode);
  return {
    backgroundCheckEscrowCents: String(split.backgroundCheckEscrowCents),
    platformEscrowCents: String(split.platformEscrowCents),
    backgroundCheckHoldCents: String(computeTrainerSignupBackgroundEscrowHoldCents(pricingMode)),
    platformHoldCents: String(computeTrainerSignupPlatformHoldCents(pricingMode)),
    backgroundCheckProcessingCents: String(processing.backgroundCheckProcessingCents),
    platformProcessingCents: String(processing.platformProcessingCents),
    captureOnSuccessCents: String(computeTrainerSignupCaptureOnSuccessCents(pricingMode)),
    captureOnBgFailureCents: String(computeTrainerSignupCaptureOnBgFailureCents(pricingMode)),
  };
}
