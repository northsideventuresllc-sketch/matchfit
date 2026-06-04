/** Signup-step agreement copy (fees only — enforcement details live in Terms / Privacy). */

export const TRAINER_SIGNUP_AGREEMENT_DOCUMENT = `Match Fit connects fitness professionals with clients who discover coaches through the platform. You agree to provide accurate information during signup, certification review, and background screening.

During beta, founding coaches pay the independent background screening fee plus 20% of that amount and a card processing fee at signup. Other coaches pay a $100.00 platform registration fee plus processing at signup. Your card is authorized at signup; Match Fit captures the registration amount only after your certification and background check are approved.

You will have limited dashboard access right after payment. To unlock messaging, client discovery, services, and premium tools, upload your credentials and complete Checkr background screening within the compliance window described in the Terms of Service.

The Onboarding Questionnaire is required for matching but does not count against your certification and screening deadline.

Off-platform payment rules, liquidated damages, suspension, and account closure policies are defined only in the Terms of Service and Privacy Policy.`;

/** @deprecated Onboarding checklist removed — use {@link TRAINER_SIGNUP_AGREEMENT_DOCUMENT} at signup. */
export const TRAINER_ONBOARDING_AGREEMENT_COUNT = 1;

/** Compliance archive / admin — fee summary without enforcement copy. */
export function getTrainerOnboardingAgreementBullets(foundingCoachPricing: boolean): readonly string[] {
  if (foundingCoachPricing) {
    return [
      "Founding coach signup: background screening fee + 20% platform surcharge + card processing (authorized at signup, captured after approval).",
      "Limited dashboard until certification and background check are approved.",
      "Full Terms of Service and Privacy Policy govern enforcement, fees, and account policies.",
    ];
  }
  return [
    "Standard signup: $100.00 platform registration + card processing (authorized at signup, captured after approval).",
    "Limited dashboard until certification and background check are approved.",
    "Full Terms of Service and Privacy Policy govern enforcement, fees, and account policies.",
  ];
}

/** @deprecated */
export const TRAINER_ONBOARDING_AGREEMENT_BULLETS: readonly string[] = getTrainerOnboardingAgreementBullets(false);
