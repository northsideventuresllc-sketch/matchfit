import {
  computeCheckoutFeeBreakdown,
  feeMetadataFromBreakdown,
} from "@/lib/stripe-checkout-line-items";
import { trainerBackgroundCheckAmountCents } from "@/lib/trainer-background-check-stripe";
import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotions";
import { TRAINER_PLATFORM_REGISTRATION_FEE_CENTS } from "@/lib/trainer-registration-fee";
import { getStripe } from "@/lib/stripe-server";

export const TRAINER_SIGNUP_FEE_HOLD_PURPOSE = "trainer_signup_fee_hold";

/** Base platform amount due at signup (cents, before processing fee). */
export function computeTrainerSignupFeeBaseCents(pricingMode: TrainerRegistrationPricingMode): number {
  if (pricingMode === "FOUNDING_BG_SURCHARGE_20PCT") {
    const bg = trainerBackgroundCheckAmountCents();
    return bg + Math.max(1, Math.round(bg * 0.2));
  }
  return TRAINER_PLATFORM_REGISTRATION_FEE_CENTS;
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

export async function cancelTrainerSignupFeeHold(paymentIntentId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not configured.");
  try {
    await stripe.paymentIntents.cancel(paymentIntentId);
  } catch {
    // Already captured or canceled — ignore.
  }
}
