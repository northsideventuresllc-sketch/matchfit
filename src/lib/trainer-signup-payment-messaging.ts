import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotion-caps";
import { computeTrainerSignupEscrowSplit } from "@/lib/trainer-signup-escrow-split";
import { trainerBackgroundCheckAmountCents } from "@/lib/trainer-background-check-fee";
import { TRAINER_PLATFORM_REGISTRATION_FEE_CENTS } from "@/lib/trainer-platform-registration-fee";
import {
  TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE,
  TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS,
  TRAINER_SIGNUP_PREMIUM_PROMO_DAYS,
  trainerIndependentProSubscriptionLabel,
  trainerIndependentProTrialBenefitLabel,
  trainerSignupPremiumPromoBenefitLabel,
} from "@/lib/trainer-signup-promo-copy";

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Short overview on the first signup page — no payment jargon yet. */
export const TRAINER_SIGNUP_FLOW_OVERVIEW =
  `How Fitness Pro signup works: (1) enter your account details and verify email, (2) accept the Fitness Pro agreement — your account is created automatically, (3) choose your account type — Match Fit Premium Pro is complimentary for beta users for ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days; Independent Fitness Pro includes a ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS}-day free trial, then the ${trainerIndependentProSubscriptionLabel()} subscription keeps your account active; Elite Fitness Pro requires a paid subscription, (4) upload required documents for review, (5) authorize your signup fee and complete background screening. You must begin onboarding within ${TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days of sign-up. Founding Fitness Pros receive ${trainerSignupPremiumPromoBenefitLabel()} at sign-up. ${TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE}`;

/** Payment step headline helper text — explains hold vs charge. */
export const TRAINER_SIGNUP_PAYMENT_INTRO =
  "This step pays your background check through Match Fit's portal (plus card processing). Match Fit does not capture charges until the rules below are met.";

export function trainerSignupPaymentHoldExplanation(pricingMode: TrainerRegistrationPricingMode): string {
  const split = computeTrainerSignupEscrowSplit(pricingMode);
  const bgLabel = formatUsd(split.backgroundCheckEscrowCents);
  const platformLabel = formatUsd(split.platformEscrowCents);

  if (pricingMode === "FOUNDING_BG_COVERED" || pricingMode === "FOUNDING_BG_SURCHARGE_20PCT") {
    return `Founding Fitness Pro pricing: Match Fit covers your Checkr background screening. Today's hold is only the ${platformLabel} Match Fit platform portion (20% of the standard screening estimate), plus card processing. Match Fit captures the platform portion only after certification and screening review finish. If you are fully approved, the platform hold is captured. If you are not approved, the platform hold is released. You must begin onboarding within ${TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days of sign-up. You receive ${trainerSignupPremiumPromoBenefitLabel()} at sign-up. Independent Fitness Pro includes ${trainerIndependentProTrialBenefitLabel()} of platform access; after the trial, the ${trainerIndependentProSubscriptionLabel()} subscription keeps your account active. ${TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE}`;
  }

  const listPrice = formatUsd(TRAINER_PLATFORM_REGISTRATION_FEE_CENTS);
  return `Standard signup: today's authorization may include up to ${listPrice} total — an estimated ${bgLabel} background screening portion plus a ${platformLabel} Match Fit platform balance, plus card processing on each slice. When Checkr screening completes, the screening portion is captured for Checkr. The platform portion stays on hold until review finishes. If you are fully approved, the platform portion is captured. If you are not approved, the platform hold is released. You must begin onboarding within ${TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days of sign-up. ${TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE}`;
}

export const TRAINER_SIGNUP_PAYMENT_AFTER_HOLD_NOTE =
  "After payment is set up, you'll unlock your limited dashboard to upload certification, tax forms, and complete background screening. You still cannot sell services until every onboarding requirement is approved.";

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
