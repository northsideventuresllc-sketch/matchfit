import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotion-caps";
import { getAppOrigin } from "@/lib/app-origin";
import { feeMetadataFromBreakdown } from "@/lib/stripe-checkout-line-items";
import { getStripe } from "@/lib/stripe-server";
import {
  computeTrainerSignupBackgroundEscrowHoldCents,
  computeTrainerSignupEscrowSplit,
  computeTrainerSignupPlatformHoldCents,
  signupEscrowMetadata,
} from "@/lib/trainer-signup-escrow";
import {
  createTrainerSignupBackgroundEscrowPaymentIntent,
  TRAINER_SIGNUP_BG_ESCROW_PURPOSE,
  TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE,
} from "@/lib/trainer-signup-fee-hold";

export async function createTrainerSignupFeeHoldCheckoutSession(args: {
  trainerId: string;
  email: string;
  pricingMode: TrainerRegistrationPricingMode;
  origin?: string;
}): Promise<{
  url: string;
  baseCents: number;
  totalCents: number;
  backgroundCheckPaymentIntentId: string;
}> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Billing is not configured.");
  }

  const email = args.email.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Trainer account email is missing or invalid for Stripe checkout.");
  }

  const split = computeTrainerSignupEscrowSplit(args.pricingMode);
  const platformHoldCents = computeTrainerSignupPlatformHoldCents(args.pricingMode);
  const backgroundCheckHoldCents = computeTrainerSignupBackgroundEscrowHoldCents(args.pricingMode);
  const escrowMeta = signupEscrowMetadata(args.pricingMode);

  const backgroundCheck = await createTrainerSignupBackgroundEscrowPaymentIntent({
    trainerId: args.trainerId,
    email,
    pricingMode: args.pricingMode,
  });

  const origin = (args.origin ?? getAppOrigin()).replace(/\/$/, "");
  const modeLabel =
    args.pricingMode === "FOUNDING_BG_SURCHARGE_20PCT"
      ? "Founding coach signup fee hold"
      : "Trainer signup fee hold";

  const paymentIntentMetadata = {
    purpose: TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE,
    trainerId: args.trainerId,
    pricingMode: args.pricingMode,
    holdSlice: "platform",
    platformEscrowCents: String(split.platformEscrowCents),
    platformHoldCents: String(platformHoldCents),
    backgroundCheckPaymentIntentId: backgroundCheck.paymentIntentId,
    ...escrowMeta,
    ...feeMetadataFromBreakdown({
      baseCents: split.platformEscrowCents,
      adminCents: 0,
      processingCents: platformHoldCents - split.platformEscrowCents,
      totalChargedCents: platformHoldCents,
    }),
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
          unit_amount: platformHoldCents,
          product_data: {
            name: "Match Fit trainer platform onboarding authorization",
            description: `${modeLabel}. Screening hold captured when Checkr runs; platform hold captured only after certification and background screening are approved.`,
          },
        },
      },
    ],
    payment_intent_data: {
      capture_method: "manual",
      receipt_email: email,
      metadata: paymentIntentMetadata,
    },
    metadata: {
      purpose: TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE,
      trainerId: args.trainerId,
      pricingMode: args.pricingMode,
      backgroundCheckPaymentIntentId: backgroundCheck.paymentIntentId,
    },
    success_url: `${origin}/trainer/signup/payment/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/trainer/signup/payment?canceled=1`,
  });

  if (!session.url) {
    throw new Error("Could not start checkout.");
  }

  return {
    url: session.url,
    baseCents: split.baseCents,
    totalCents: platformHoldCents + backgroundCheckHoldCents,
    backgroundCheckPaymentIntentId: backgroundCheck.paymentIntentId,
  };
}

export function paymentIntentIdFromCheckoutSession(
  paymentIntent: string | { id: string } | null | undefined,
): string | null {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id ?? null;
}

export { TRAINER_SIGNUP_BG_ESCROW_PURPOSE, TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE };
