import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotion-caps";
import { getAppOrigin } from "@/lib/app-origin";
import { getStripe } from "@/lib/stripe-server";
import {
  createTrainerSignupFeeHoldPaymentIntents,
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

  const intents = await createTrainerSignupFeeHoldPaymentIntents({
    trainerId: args.trainerId,
    email,
    pricingMode: args.pricingMode,
  });

  const origin = (args.origin ?? getAppOrigin()).replace(/\/$/, "");
  const modeLabel =
    args.pricingMode === "FOUNDING_BG_SURCHARGE_20PCT"
      ? "Founding coach signup fee hold"
      : "Trainer signup fee hold";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: intents.platformHoldCents,
          product_data: {
            name: "Match Fit trainer platform onboarding authorization",
            description: `${modeLabel}. Match Fit captures the platform portion only after certification and background screening are approved.`,
          },
        },
      },
    ],
    payment_intent: intents.platformPaymentIntentId,
    metadata: {
      purpose: TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE,
      trainerId: args.trainerId,
      pricingMode: args.pricingMode,
      backgroundCheckPaymentIntentId: intents.backgroundCheckPaymentIntentId,
    },
    success_url: `${origin}/trainer/signup/payment/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/trainer/signup/payment?canceled=1`,
  });

  if (!session.url) {
    throw new Error("Could not start checkout.");
  }

  return {
    url: session.url,
    baseCents: intents.baseCents,
    totalCents: intents.totalCents,
    backgroundCheckPaymentIntentId: intents.backgroundCheckPaymentIntentId,
  };
}

export function paymentIntentIdFromCheckoutSession(
  paymentIntent: string | { id: string } | null | undefined,
): string | null {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id ?? null;
}

export { TRAINER_SIGNUP_BG_ESCROW_PURPOSE, TRAINER_SIGNUP_PLATFORM_HOLD_PURPOSE };
