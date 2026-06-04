import {
  computeCheckoutFeeBreakdown,
  feeMetadataFromBreakdown,
} from "@/lib/stripe-checkout-line-items";
import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotions";
import {
  computeTrainerSignupCaptureOnBgFailureCents,
  computeTrainerSignupCaptureOnSuccessCents,
  computeTrainerSignupEscrowSplit,
  signupEscrowMetadata,
} from "@/lib/trainer-signup-escrow";
import { getStripe } from "@/lib/stripe-server";

export const TRAINER_SIGNUP_FEE_HOLD_PURPOSE = "trainer_signup_fee_hold";

/** Base platform amount due at signup (cents, before processing fee). */
export function computeTrainerSignupFeeBaseCents(pricingMode: TrainerRegistrationPricingMode): number {
  return computeTrainerSignupEscrowSplit(pricingMode).baseCents;
}

export async function createTrainerSignupFeeHoldPaymentIntent(args: {
  trainerId: string;
  email: string;
  pricingMode: TrainerRegistrationPricingMode;
}): Promise<{ clientSecret: string; paymentIntentId: string; baseCents: number; totalCents: number }> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const baseCents = computeTrainerSignupFeeBaseCents(args.pricingMode);
  const breakdown = computeCheckoutFeeBreakdown({
    baseCents,
    includeAdminFee: false,
    includeProcessingFee: true,
  });

  const pi = await stripe.paymentIntents.create({
    amount: breakdown.totalChargedCents,
    currency: "usd",
    receipt_email: args.email,
    capture_method: "manual",
    automatic_payment_methods: { enabled: true },
    metadata: {
      purpose: TRAINER_SIGNUP_FEE_HOLD_PURPOSE,
      trainerId: args.trainerId,
      pricingMode: args.pricingMode,
      baseCents: String(breakdown.baseCents),
      processingFeeCents: String(breakdown.processingCents),
      totalChargedCents: String(breakdown.totalChargedCents),
      ...feeMetadataFromBreakdown(breakdown),
      ...signupEscrowMetadata(args.pricingMode),
    },
  });

  if (!pi.client_secret) {
    throw new Error("Stripe did not return a client secret for this payment.");
  }

  return {
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    baseCents: breakdown.baseCents,
    totalCents: breakdown.totalChargedCents,
  };
}

export async function captureTrainerSignupFeeHold(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  await stripe.paymentIntents.capture(paymentIntentId);
}

/** Capture held signup fee when compliance succeeds (full authorized total). */
export async function captureTrainerSignupFeeHoldOnComplianceSuccess(
  paymentIntentId: string,
  pricingMode: TrainerRegistrationPricingMode,
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  const amount = computeTrainerSignupCaptureOnSuccessCents(pricingMode);
  await stripe.paymentIntents.capture(paymentIntentId, { amount_to_capture: amount });
}

/**
 * If background screening never clears, capture only the platform (+ processing) portion.
 * The background-check escrow portion is not applied to the trainer's account.
 */
export async function captureTrainerSignupFeeHoldPartial(
  paymentIntentId: string,
  pricingMode: TrainerRegistrationPricingMode,
  _reason: "bg_failure",
): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  const amount = computeTrainerSignupCaptureOnBgFailureCents(pricingMode);
  await stripe.paymentIntents.capture(paymentIntentId, { amount_to_capture: amount });
}

export async function cancelTrainerSignupFeeHold(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  try {
    await stripe.paymentIntents.cancel(paymentIntentId);
  } catch {
    // Already captured or canceled — ignore.
  }
}
