/** Signup-step agreement copy (fees only — enforcement details live in Terms / Privacy). */

import {
  TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE,
  TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS,
  TRAINER_SIGNUP_PREMIUM_PROMO_DAYS,
  TRAINER_SIGNUP_STANDARD_PLATFORM_FEE_LABEL,
} from "@/lib/trainer-signup-promo-copy";

export const TRAINER_SIGNUP_AGREEMENT_DOCUMENT = `Match Fit connects fitness professionals with clients who discover coaches through the platform. You agree to provide accurate information during signup, certification review, and background screening.

During the founding coach promo, you receive ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days of Premium Page access at sign-up and pay only your independent background screening fee through Match Fit's portal (plus card processing)—not the ${TRAINER_SIGNUP_STANDARD_PLATFORM_FEE_LABEL} platform registration fee. You must begin onboarding within ${TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days of creating your account, including paying the background check through our portal and starting certification and screening steps. ${TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE}

After founding caps are reached, other coaches pay the standard ${TRAINER_SIGNUP_STANDARD_PLATFORM_FEE_LABEL} platform registration model described in the Terms of Service. Your card may be authorized at signup when a hold is required; Match Fit captures charges only according to the rules in the Terms.

You will have limited dashboard access right after sign-up. To unlock messaging, client discovery, and the ability to sell services, upload your credentials and complete Checkr background screening within the compliance window described in the Terms of Service.

The Onboarding Questionnaire is required for matching but does not count against your certification and screening deadline.

Off-platform payment rules, liquidated damages, suspension, and account closure policies are defined only in the Terms of Service and Privacy Policy.`;

/** @deprecated Onboarding checklist removed — use {@link TRAINER_SIGNUP_AGREEMENT_DOCUMENT} at signup. */
export const TRAINER_ONBOARDING_AGREEMENT_COUNT = 1;

/** Compliance archive / admin — fee summary without enforcement copy. */
export function getTrainerOnboardingAgreementBullets(foundingCoachPricing: boolean): readonly string[] {
  if (foundingCoachPricing) {
    return [
      `Founding coach promo: ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days of Premium Page access at sign-up; pay only the background screening fee through Match Fit's portal (no ${TRAINER_SIGNUP_STANDARD_PLATFORM_FEE_LABEL} platform fee).`,
      `Begin onboarding within ${TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days of sign-up. ${TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE}`,
      "Limited dashboard until certification and background check are approved.",
      "Full Terms of Service and Privacy Policy govern enforcement, fees, and account policies.",
    ];
  }
  return [
    `Standard signup: ${TRAINER_SIGNUP_STANDARD_PLATFORM_FEE_LABEL} platform registration + card processing (authorized at signup, captured after approval).`,
    `Begin onboarding within ${TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days of sign-up. ${TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE}`,
    "Limited dashboard until certification and background check are approved.",
    "Full Terms of Service and Privacy Policy govern enforcement, fees, and account policies.",
  ];
}

/** @deprecated */
export const TRAINER_ONBOARDING_AGREEMENT_BULLETS: readonly string[] = getTrainerOnboardingAgreementBullets(false);
