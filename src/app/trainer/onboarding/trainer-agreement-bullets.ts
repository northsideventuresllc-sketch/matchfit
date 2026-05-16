/** Checkbox copy for step 1 — trainer fees, screening, account lifecycle, and platform policies. */

const TRAINER_ONBOARDING_AGREEMENT_BULLETS_STANDARD = [
  "The trainer registration fee is $100.00, and a separate transaction processing fee will be added to this amount when you are charged.",
  "The background check is administered and priced by an independent third-party screening company that Match Fit will integrate with in a future release; you are responsible for paying the background check provider according to its instructions.",
  "Match Fit does not refund background-check fees; any refund eligibility is determined solely by the background-check provider, not Match Fit.",
  "Match Fit will not collect the trainer registration fee until your background check has cleared and your CPT certification has been verified.",
  "Your account cannot be updated further until your background check has returned as cleared under our screening policy.",
  "If your background check returns a warning or flag, a Match Fit representative will have a confidential one-on-one conversation with you, and you will be contacted by email to schedule a phone call only when there is a flag on your background check.",
  "Once the registration fee is collected, it is non-refundable.",
  "If your onboarding does not progress for 30 consecutive days, your username and associated onboarding data may be automatically deleted; if you choose to pursue becoming a trainer later, you may start again from the beginning.",
  "Your username is reserved for you during this 30-day activity window; if the window expires without sufficient progress, the username may become available to another applicant.",
  "If your background check clears and you choose to proceed, the 30-day activity window resets automatically.",
  "If you upload your CPT file for review, the 30-day activity window resets automatically.",
  "After your CPT has been verified and your background check has cleared, your username remains associated with your trainer record until you choose to delete your account.",
  "You are in control of whether your account is deleted; if you delete your account, you will have 30 days to log back in to cancel that deletion.",
  "If 30 days pass after account deletion without you logging in to cancel, your account will be removed and you will need to complete the entire sign-up and onboarding process again to create a new account.",
  "Any Trainer found soliciting or accepting payments off-platform for clients first discovered through Match Fit agrees to pay a $1,000.00 Liquidated Damages Fee per occurrence (see Terms of Service).",
  "Violations of the Terms of Service may result in account suspension or termination.",
  "If behavior is deemed egregious enough to warrant it, Match Fit may permanently ban you from the platform using identifying information from your tax forms (such as your Social Security number or taxpayer identification number), not merely by username.",
  "Match Fit will make its best effort to keep your personal information secure; if a data breach occurs that may affect trainers, Match Fit will notify affected trainers in line with applicable law.",
  "You agree to provide accurate and truthful information at every stage (screening, certification, tax, and profile), cooperate with reasonable compliance requests, treat clients and Match Fit staff respectfully, follow applicable laws, and understand that Match Fit may update operational policies with reasonable notice where permitted by law.",
  "By checking each box in this list, you confirm that you have read, understood, and agree to every statement above and to the basic Trainer Terms of Service that govern your use of Match Fit.",
] as const;

/** Same length as {@link getTrainerOnboardingAgreementBullets}; indices 0, 3, and 6 differ when the registration fee is waived. */
const TRAINER_ONBOARDING_AGREEMENT_BULLETS_REGISTRATION_WAIVED = [
  "The standard trainer registration fee is $100.00, but your account is in a limited founding-coach window: Match Fit waives that one-time platform registration fee for you. You are still responsible for the independent background-check provider’s fee when screening is collected, plus any provider processing charges.",
  "The background check is administered and priced by an independent third-party screening company that Match Fit will integrate with in a future release; you are responsible for paying the background check provider according to its instructions.",
  "Match Fit does not refund background-check fees; any refund eligibility is determined solely by the background-check provider, not Match Fit.",
  "Because your founding-coach slot waives the platform registration fee, Match Fit will not charge you the $100.00 registration fee after your background check clears and your CPT certification is verified. Other compliance and activation steps still apply before your profile can go live.",
  "Your account cannot be updated further until your background check has returned as cleared under our screening policy.",
  "If your background check returns a warning or flag, a Match Fit representative will have a confidential one-on-one conversation with you, and you will be contacted by email to schedule a phone call only when there is a flag on your background check.",
  "The waived registration fee is a promotional benefit; Match Fit does not owe a cash refund for that waived amount because it is not charged for your founding slot. Other fees you actually pay (for example, to a screening vendor) remain subject to the provider’s refund rules.",
  "If your onboarding does not progress for 30 consecutive days, your username and associated onboarding data may be automatically deleted; if you choose to pursue becoming a trainer later, you may start again from the beginning.",
  "Your username is reserved for you during this 30-day activity window; if the window expires without sufficient progress, the username may become available to another applicant.",
  "If your background check clears and you choose to proceed, the 30-day activity window resets automatically.",
  "If you upload your CPT file for review, the 30-day activity window resets automatically.",
  "After your CPT has been verified and your background check has cleared, your username remains associated with your trainer record until you choose to delete your account.",
  "You are in control of whether your account is deleted; if you delete your account, you will have 30 days to log back in to cancel that deletion.",
  "If 30 days pass after account deletion without you logging in to cancel, your account will be removed and you will need to complete the entire sign-up and onboarding process again to create a new account.",
  "Any Trainer found soliciting or accepting payments off-platform for clients first discovered through Match Fit agrees to pay a $1,000.00 Liquidated Damages Fee per occurrence (see Terms of Service).",
  "Violations of the Terms of Service may result in account suspension or termination.",
  "If behavior is deemed egregious enough to warrant it, Match Fit may permanently ban you from the platform using identifying information from your tax forms (such as your Social Security number or taxpayer identification number), not merely by username.",
  "Match Fit will make its best effort to keep your personal information secure; if a data breach occurs that may affect trainers, Match Fit will notify affected trainers in line with applicable law.",
  "You agree to provide accurate and truthful information at every stage (screening, certification, tax, and profile), cooperate with reasonable compliance requests, treat clients and Match Fit staff respectfully, follow applicable laws, and understand that Match Fit may update operational policies with reasonable notice where permitted by law.",
  "By checking each box in this list, you confirm that you have read, understood, and agree to every statement above and to the basic Trainer Terms of Service that govern your use of Match Fit.",
] as const;

export const TRAINER_ONBOARDING_AGREEMENT_COUNT = TRAINER_ONBOARDING_AGREEMENT_BULLETS_STANDARD.length;

if (TRAINER_ONBOARDING_AGREEMENT_BULLETS_REGISTRATION_WAIVED.length !== TRAINER_ONBOARDING_AGREEMENT_COUNT) {
  throw new Error("Trainer agreement bullet lists must stay the same length.");
}

/**
 * Acknowledgement lines shown during trainer onboarding (and compliance review).
 * When `registrationFeeWaived` is true, fee-related lines describe the founding-coach promotion.
 */
export function getTrainerOnboardingAgreementBullets(registrationFeeWaived: boolean): readonly string[] {
  return registrationFeeWaived ? TRAINER_ONBOARDING_AGREEMENT_BULLETS_REGISTRATION_WAIVED : TRAINER_ONBOARDING_AGREEMENT_BULLETS_STANDARD;
}

/** @deprecated Use {@link getTrainerOnboardingAgreementBullets}(false) for static standard copy. */
export const TRAINER_ONBOARDING_AGREEMENT_BULLETS: readonly string[] = TRAINER_ONBOARDING_AGREEMENT_BULLETS_STANDARD;
