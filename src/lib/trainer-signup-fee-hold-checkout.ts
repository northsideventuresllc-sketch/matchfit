import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotion-caps";
import { getAppOrigin } from "@/lib/app-origin";
import { computeCheckoutFeeBreakdown, feeMetadataFromBreakdown } from "@/lib/stripe-checkout-line-items";
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

  const email = args.email.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Trainer account email is missing or invalid for Stripe checkout.");
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
      ? "Founding coach signup fee hold"
      : "Trainer signup fee hold";

  const paymentIntentMetadata = {
    purpose: TRAINER_SIGNUP_FEE_HOLD_PURPOSE,
    trainerId: args.trainerId,
    pricingMode: args.pricingMode,
    ...feeMetadataFromBreakdown(breakdown),
    ...signupEscrowMetadata(args.pricingMode),
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: breakdown.totalChargedCents,
          product_data: {
            name: "Match Fit trainer signup fee authorization",
            description: `${modeLabel}. Match Fit captures only after certification and background screening are approved.`,
          },
        },
      },
    ],
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
