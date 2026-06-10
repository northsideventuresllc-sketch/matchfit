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

  if (pricingMode === "FOUNDING_BG_SURCHARGE_20PCT") {
    return `Founding coach pricing: today's holds include an estimated ${bgLabel} background screening portion plus a ${platformLabel} Match Fit platform portion (20% of the screening estimate), plus card processing on each slice. When Checkr screening completes — whether it clears or not — the screening portion is captured so Match Fit can pay Checkr. The platform portion stays on hold until certification and screening review finish. If you are fully approved, the platform portion is captured. If you are not approved, the platform hold is released.`;
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

/** Agreement step — fee summary without enforcement legalese (details in Terms). */
export const TRAINER_SIGNUP_AGREEMENT_BILLING_DOCUMENT = `During beta, signup places two temporary card holds in Stripe: a background screening portion and a Match Fit platform onboarding portion (plus card processing on each slice). Founding coaches (first slots) hold the estimated Checkr screening amount plus 20% of that estimate for the platform slice. Other coaches hold up to $100.00 split between screening and platform balances.

When Checkr screening runs — whether it clears or not — Match Fit captures the screening hold to pay Checkr. The platform hold stays uncaptured until certification and screening review finish. If you are fully approved, the platform hold is captured. If you are not approved, the platform hold is released.

You receive limited dashboard access after both holds are placed. Upload credentials and complete Checkr screening within the compliance window in the Terms of Service.`;

export function getTrainerSignupAgreementBillingBullets(foundingCoachPricing: boolean): readonly string[] {
  if (foundingCoachPricing) {
    return [
      "Founding coach signup: two card holds — estimated Checkr screening portion + 20% platform surcharge (+ processing on each slice).",
      "Screening hold captured when Checkr runs; platform hold captured only after full approval (released if denied).",
      "Limited dashboard until certification and background check are approved.",
    ];
  }
  return [
    "Standard signup: two card holds — screening portion + platform balance up to $100.00 (+ processing on each slice).",
    "Screening hold captured when Checkr runs; platform hold captured only after full approval (released if denied).",
    "Limited dashboard until certification and background check are approved.",
  ];
}

export const TRAINER_SIGNUP_COMPLIANCE_DASHBOARD_INTRO =
  "Upload credentials and complete Checkr screening to unlock messaging, services, premium tools, and client discovery. The platform onboarding hold stays uncaptured until you are fully approved; the screening hold is captured when Checkr runs.";

export const TRAINER_SIGNUP_COMPLIANCE_APPROVED_CAPTURE_NOTE =
  "Compliance approved — Match Fit captures your held platform onboarding fee. Your screening hold was already applied when Checkr screening ran.";

export const TRAINER_SIGNUP_COMPLIANCE_ESCROW_BG_NOTE =
  "Your signup holds include background screening. Complete your Checkr invitation from email, or contact support if you need a new link.";

export const TRAINER_SIGNUP_COMPLIANCE_HOLD_PANEL_NOTE =
  "Your platform onboarding fee is on hold. Match Fit captures the screening hold when Checkr runs and captures the platform hold only after certifications and background check are fully approved.";

export function trainerSignupCompliancePageBillingCopy(args: {
  signupHoldFlow: boolean;
  foundingCoachPricing: boolean;
  foundingCap: number;
}): string {
  if (args.signupHoldFlow) {
    return args.foundingCoachPricing
      ? `Signup placed two Stripe holds: an estimated Checkr screening portion and a platform portion (20% of that estimate for founding coaches in the first ${args.foundingCap} slots). The screening hold is captured when Checkr runs. The platform hold is captured only after full approval — otherwise it is released.`
      : `Signup placed two Stripe holds: a screening portion and a platform balance (up to $100.00 total between them). The screening hold is captured when Checkr runs. The platform hold is captured only after full approval — otherwise it is released.`;
  }
  return args.foundingCoachPricing
    ? `Place signup holds from the payment step: estimated Checkr screening plus 20% platform surcharge for founding coaches (first ${args.foundingCap} slots), plus processing on each slice.`
    : "Place signup holds from the payment step: screening portion plus platform balance up to $100.00, plus processing on each slice.";
}

export const TRAINER_SIGNUP_BG_DENIED_NOTE =
  "Screening did not clear. Match Fit captured the screening hold when Checkr ran; your platform onboarding hold was released per Terms.";

export const TRAINER_SIGNUP_BG_APPROVED_NOTE =
  "Background screening cleared. Your screening hold was captured when Checkr ran; your platform hold is captured after full compliance approval.";

export const TRAINER_SIGNUP_PLAN_B_ESCROW_NOTE =
  "Match Fit is using our manual Checkr invitation process while the direct API finishes setup. Both signup holds must be in place before screening is ordered — the screening hold is captured when Checkr runs.";
