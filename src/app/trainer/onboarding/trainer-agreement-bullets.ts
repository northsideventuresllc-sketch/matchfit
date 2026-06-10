import {
  TRAINER_SIGNUP_AGREEMENT_BILLING_DOCUMENT,
  getTrainerSignupAgreementBillingBullets,
} from "@/lib/trainer-signup-payment-messaging";

/** Signup-step agreement copy (fees only — enforcement details live in Terms / Privacy). */

export const TRAINER_SIGNUP_AGREEMENT_DOCUMENT = `Match Fit connects fitness professionals with clients who discover coaches through the platform. You agree to provide accurate information during signup, certification review, and background screening.

${TRAINER_SIGNUP_AGREEMENT_BILLING_DOCUMENT}

You will have limited dashboard access right after both signup holds are placed. To unlock messaging, client discovery, services, and premium tools, upload your credentials and complete Checkr background screening within the compliance window described in the Terms of Service.

The Onboarding Questionnaire is required for matching but does not count against your certification and screening deadline.

Off-platform payment rules, liquidated damages, suspension, and account closure policies are defined only in the Terms of Service and Privacy Policy.`;

/** @deprecated Onboarding checklist removed — use {@link TRAINER_SIGNUP_AGREEMENT_DOCUMENT} at signup. */
export const TRAINER_ONBOARDING_AGREEMENT_COUNT = 1;

/** Compliance archive / admin — fee summary without enforcement copy. */
export function getTrainerOnboardingAgreementBullets(foundingCoachPricing: boolean): readonly string[] {
  return [
    ...getTrainerSignupAgreementBillingBullets(foundingCoachPricing),
    "Full Terms of Service and Privacy Policy govern enforcement, fees, and account policies.",
  ];
}

/** @deprecated */
export const TRAINER_ONBOARDING_AGREEMENT_BULLETS: readonly string[] = getTrainerOnboardingAgreementBullets(false);
