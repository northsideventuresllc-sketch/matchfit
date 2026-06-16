/** Signup-step agreement copy (fees only — enforcement details live in Terms / Privacy). */

import {
  TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE,
  TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS,
  TRAINER_SIGNUP_PREMIUM_PROMO_DAYS,
} from "@/lib/trainer-signup-promo-copy";

export const TRAINER_SIGNUP_AGREEMENT_DOCUMENT = `Match Fit connects fitness professionals with clients who discover coaches through the platform. You agree to provide accurate information during signup, certification review, and background screening.

During beta, the first 10 founding coaches receive platform-covered Checkr background screening and pay only 20% of the standard screening estimate (plus processing) for the Match Fit platform onboarding slice at signup. You receive ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days of Premium Page access at sign-up. You must begin onboarding within ${TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days of creating your account, including starting certification and screening steps. ${TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE} Other coaches pay a $100.00 platform registration fee plus processing at signup. Your card is authorized at signup (held in Stripe); Match Fit captures the registration amount only after your certification and background check are approved. If you do not complete background screening after your Checkr invitation is sent, no background-check charge applies for founding coaches with platform-covered screening (see Terms).

After founding caps are reached, other coaches follow the onboarding fees shown at checkout in the Terms of Service. Your card may be authorized at signup when a hold is required; Match Fit captures charges only according to the rules in the Terms.

You will have limited dashboard access right after sign-up. To unlock messaging, client discovery, and the ability to sell services, upload your credentials and complete Checkr background screening within the compliance window described in the Terms of Service.

The Onboarding Questionnaire is required for matching but does not count against your certification and screening deadline.

Off-platform payment rules, liquidated damages, suspension, and account closure policies are defined only in the Terms of Service and Privacy Policy.`;

/** @deprecated Onboarding checklist removed — use {@link TRAINER_SIGNUP_AGREEMENT_DOCUMENT} at signup. */
export const TRAINER_ONBOARDING_AGREEMENT_COUNT = 1;

/** Compliance archive / admin — fee summary without enforcement copy. */
export function getTrainerOnboardingAgreementBullets(foundingCoachPricing: boolean): readonly string[] {
  if (foundingCoachPricing) {
    return [
      "Founding coach signup (first 10): Match Fit covers Checkr background screening; you authorize only the 20% platform onboarding slice plus card processing (captured after approval).",
      `${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days of Premium Page access at sign-up.`,
      `Begin onboarding within ${TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days of sign-up. ${TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE}`,
      "Limited dashboard until certification and background check are approved.",
      "Full Terms of Service and Privacy Policy govern enforcement, fees, and account policies.",
    ];
  }
  return [
    `Standard signup: onboarding fees as shown at checkout (background screening plus card processing, authorized at signup and captured after approval).`,
    `Begin onboarding within ${TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days of sign-up. ${TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE}`,
    "Limited dashboard until certification and background check are approved.",
    "Full Terms of Service and Privacy Policy govern enforcement, fees, and account policies.",
  ];
}

/** @deprecated */
export const TRAINER_ONBOARDING_AGREEMENT_BULLETS: readonly string[] = getTrainerOnboardingAgreementBullets(false);
