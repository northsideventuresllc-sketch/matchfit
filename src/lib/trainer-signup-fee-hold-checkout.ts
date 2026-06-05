import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotions";
import { getAppOrigin } from "@/lib/app-origin";
import {
  computeCheckoutFeeBreakdown,
  feeMetadataFromBreakdown,
  stripeCheckoutLineItemsFromBreakdown,
} from "@/lib/stripe-checkout-line-items";
import { getStripe } from "@/lib/stripe-server";
import {
  computeTrainerSignupFeeBaseCents,
  TRAINER_SIGNUP_FEE_HOLD_PURPOSE,
} from "@/lib/trainer-signup-fee-hold";
import { signupEscrowMetadata } from "@/lib/trainer-signup-escrow";

export async function createTrainerSignupFeeHoldCheckoutSession(args: {
  trainerId: string;
  email: string;
  pricingMode: TrainerRegistrationPricingMode;
  origin?: string;
}): Promise<{ url: string; baseCents: number; totalCents: number }> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Billing is not configured.");
  }

  const baseCents = computeTrainerSignupFeeBaseCents(args.pricingMode);
  const breakdown = computeCheckoutFeeBreakdown({
    baseCents,
    includeAdminFee: false,
    includeProcessingFee: true,
  });

  const origin = (args.origin ?? getAppOrigin()).replace(/\/$/, "");
  const modeLabel =
    args.pricingMode === "FOUNDING_BG_SURCHARGE_20PCT"
      ? "Founding coach signup fee hold (background screening + platform portion)"
      : "Trainer signup fee hold ($100 platform registration)";

  const paymentIntentMetadata = {
    purpose: TRAINER_SIGNUP_FEE_HOLD_PURPOSE,
    trainerId: args.trainerId,
    pricingMode: args.pricingMode,
    baseCents: String(breakdown.baseCents),
    processingFeeCents: String(breakdown.processingCents),
    totalChargedCents: String(breakdown.totalChargedCents),
    ...feeMetadataFromBreakdown(breakdown),
    ...signupEscrowMetadata(args.pricingMode),
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: args.email,
    line_items: stripeCheckoutLineItemsFromBreakdown({
      breakdown,
      baseName: "Match Fit trainer signup fee authorization",
      baseDescription: `${modeLabel}. Match Fit captures only after certification and background screening are approved.`,
      includeAdminFee: false,
      includeProcessingFee: true,
    }),
    payment_intent_data: {
      capture_method: "manual",
      metadata: paymentIntentMetadata,
    },
    metadata: {
      purpose: TRAINER_SIGNUP_FEE_HOLD_PURPOSE,
      trainerId: args.trainerId,
      pricingMode: args.pricingMode,
    },
    success_url: `${origin}/trainer/signup/payment/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/trainer/signup/payment?canceled=1`,
  });

  if (!session.url) {
    throw new Error("Could not start checkout.");
  }

  return { url: session.url, baseCents: breakdown.baseCents, totalCents: breakdown.totalChargedCents };
}

export function paymentIntentIdFromCheckoutSession(
  paymentIntent: string | { id: string } | null | undefined,
): string | null {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id ?? null;
}
