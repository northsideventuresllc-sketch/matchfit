import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotions";
import { computeTrainerSignupEscrowSplit } from "@/lib/trainer-signup-escrow";
import { trainerBackgroundCheckAmountCents } from "@/lib/trainer-background-check-stripe";
import { TRAINER_PLATFORM_REGISTRATION_FEE_CENTS } from "@/lib/trainer-registration-fee";

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Short overview on the first signup page — no payment jargon yet. */
export const TRAINER_SIGNUP_FLOW_OVERVIEW =
  "How trainer signup works: (1) create your account, (2) accept the trainer agreement, (3) place a temporary card hold for your signup fee, then (4) finish certification and background screening from your dashboard. Match Fit only charges the signup fee after your documents and background check are approved.";

/** Payment step headline helper text — explains hold vs charge. */
export const TRAINER_SIGNUP_PAYMENT_INTRO =
  "This step places a temporary hold on your card for the signup fee shown below. Your bank may list it as pending — Match Fit does not capture (charge) that amount until your certification and background screening are approved.";

export function trainerSignupPaymentHoldExplanation(pricingMode: TrainerRegistrationPricingMode): string {
  const split = computeTrainerSignupEscrowSplit(pricingMode);
  const bgLabel = formatUsd(split.backgroundCheckEscrowCents);
  const platformLabel = formatUsd(split.platformEscrowCents);

  if (pricingMode === "FOUNDING_BG_SURCHARGE_20PCT") {
    return `Founding coach pricing: today's hold includes an estimated ${bgLabel} background screening portion plus a ${platformLabel} Match Fit platform portion (20% of the screening estimate), plus card processing. If screening is not approved, only the platform portion (and its processing) may be captured; the screening portion of the hold is released.`;
  }

  const listPrice = formatUsd(TRAINER_PLATFORM_REGISTRATION_FEE_CENTS);
  return `Standard pricing: today's hold is up to ${listPrice} total — an estimated ${bgLabel} background screening portion plus a ${platformLabel} Match Fit platform balance, plus card processing. If screening is not approved, only the platform portion (and its processing) may be captured.`;
}

export function trainerSignupPaymentAfterHoldNote(): string {
  return "After the hold is placed, you'll unlock your limited dashboard to upload certification, tax forms, and complete background screening. Holds that are never captured expire automatically per your card issuer's rules.";
}

/** User-safe message when Stripe keys are missing in production. */
export const TRAINER_SIGNUP_PAYMENT_UNAVAILABLE_MESSAGE =
  "Secure card authorization is temporarily unavailable while we finish payment setup. Please try again in a few minutes or contact support@match-fit.net if this continues.";

/** Shown while loading Stripe.js from runtime config. */
export const TRAINER_SIGNUP_PAYMENT_LOADING_MESSAGE = "Loading secure card authorization…";

export function trainerSignupPaymentAmountSummary(pricingMode: TrainerRegistrationPricingMode): {
  backgroundCheckCents: number;
  platformCents: number;
} {
  const split = computeTrainerSignupEscrowSplit(pricingMode);
  return {
    backgroundCheckCents: split.backgroundCheckEscrowCents,
    platformCents: split.platformEscrowCents,
  };
}

/** Reference amount for copy when exact total is still loading. */
export function trainerBackgroundCheckReferenceUsd(): string {
  return formatUsd(trainerBackgroundCheckAmountCents());
}
