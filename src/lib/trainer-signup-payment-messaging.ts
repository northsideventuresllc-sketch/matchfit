import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotion-caps";
import { computeTrainerSignupEscrowSplit } from "@/lib/trainer-signup-escrow-split";
import { trainerBackgroundCheckAmountCents } from "@/lib/trainer-background-check-fee";
import { TRAINER_PLATFORM_REGISTRATION_FEE_CENTS } from "@/lib/trainer-platform-registration-fee";

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Short overview on the first signup page — no payment jargon yet. */
export const TRAINER_SIGNUP_FLOW_OVERVIEW =
  "How trainer signup works: (1) enter your account details and verify email, (2) accept the trainer agreement — your account is created automatically, (3) finish certification and background screening from your dashboard within 7 days, and place your onboarding fee holds before the deadline. Match Fit captures the background-check portion when Checkr screening runs, and captures the platform portion only after your documents and background check are approved.";

/** Payment step headline helper text — explains hold vs charge. */
export const TRAINER_SIGNUP_PAYMENT_INTRO =
  "This step places two temporary holds on your card: one for background screening and one for the Match Fit platform onboarding fee. Your bank may list them as pending — Match Fit does not capture (charge) them until the rules below are met.";

export function trainerSignupPaymentHoldExplanation(pricingMode: TrainerRegistrationPricingMode): string {
  const split = computeTrainerSignupEscrowSplit(pricingMode);
  const bgLabel = formatUsd(split.backgroundCheckEscrowCents);
  const platformLabel = formatUsd(split.platformEscrowCents);

  if (pricingMode === "FOUNDING_BG_COVERED" || pricingMode === "FOUNDING_BG_SURCHARGE_20PCT") {
    return `Founding coach pricing: Match Fit covers your Checkr background screening. Today's hold is only the ${platformLabel} Match Fit platform portion (20% of the standard screening estimate), plus card processing. Match Fit captures the platform portion only after certification and screening review finish. If you are fully approved, the platform hold is captured. If you are not approved, the platform hold is released.`;
  }

  const listPrice = formatUsd(TRAINER_PLATFORM_REGISTRATION_FEE_CENTS);
  return `Standard pricing: today's holds total up to ${listPrice} — an estimated ${bgLabel} background screening portion plus a ${platformLabel} Match Fit platform balance, plus card processing on each slice. When Checkr screening completes, the screening portion is captured for Checkr. The platform portion stays on hold until review finishes. If you are fully approved, the platform portion is captured. If you are not approved, the platform hold is released.`;
}

export const TRAINER_SIGNUP_PAYMENT_AFTER_HOLD_NOTE =
  "After both holds are placed, you'll unlock your limited dashboard to upload certification, tax forms, and complete background screening. Uncaptured holds expire automatically per your card issuer's rules.";

export function trainerSignupPaymentAfterHoldNote(): string {
  return TRAINER_SIGNUP_PAYMENT_AFTER_HOLD_NOTE;
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
