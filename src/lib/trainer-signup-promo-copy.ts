/**
 * Shared trainer signup promo constants and user-facing copy.
 * Keep marketing pages, legal text, signup flows, and dashboard banners aligned.
 */

import { getTrainerFoundingBgPercentMax } from "@/lib/match-fit-launch-promotion-caps";

/** Complimentary Match Fit Premium Pro access included with the current beta Fitness Pro promo. */
export const TRAINER_SIGNUP_PREMIUM_PROMO_DAYS = 60;

/** Fitness Pros must begin onboarding (background check + compliance steps) within this window after sign-up. */
export const TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS = 7;

export function trainerSignupPremiumPromoBenefitLabel(): string {
  return `${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days of Match Fit Premium Pro`;
}

export function trainerSignupOnboardingBeginDeadlineLabel(): string {
  return `${TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days`;
}

/** Verified Fit Pro paths eligible for founding background-check coverage. */
export function trainerFoundingBgCheckEligibleTiersLabel(): string {
  return "Match Fit Pro and Match Fit Premium Pro";
}

/** Marketing line for platform-covered Checkr screening (founding cohort). */
export function trainerFoundingBgCheckBenefitLabel(): string {
  return "a fully covered background check from Match Fit — zero upfront screening cost";
}

/** Short label for promo bullets and feature rows. */
export function trainerFoundingBgCheckBenefitShortLabel(): string {
  return "Fully covered background check — zero upfront cost";
}

/** One sentence for hero / banner Fitness Pro promo bullets. */
export function trainerFoundingPromoHeadline(trainerCap = getTrainerFoundingBgPercentMax()): string {
  return `The first ${trainerCap} ${trainerFoundingBgCheckEligibleTiersLabel()} sign-ups receive ${trainerFoundingBgCheckBenefitLabel()}, plus ${trainerSignupPremiumPromoBenefitLabel()} at sign-up. Begin onboarding within ${trainerSignupOnboardingBeginDeadlineLabel()} of creating your account.`;
}

/** Positive bullet list for founding Fitness Pro promos (home, promos page). */
export function trainerFoundingPromoBullets(trainerCap = getTrainerFoundingBgPercentMax()): readonly string[] {
  return [
    `${trainerFoundingBgCheckBenefitShortLabel()} for the first ${trainerCap} ${trainerFoundingBgCheckEligibleTiersLabel()} sign-ups.`,
    `${trainerSignupPremiumPromoBenefitLabel()} at sign-up.`,
    `Begin onboarding within ${trainerSignupOnboardingBeginDeadlineLabel()} of creating your account.`,
  ];
}

/** Selling restriction repeated wherever Fitness Pros learn promo rules. */
export const TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE =
  "You cannot sell or offer services on Match Fit until every onboarding requirement is completed.";

/** Full founding promo paragraph for promos / legal summaries. */
export function trainerFoundingPromoParagraph(trainerCap = getTrainerFoundingBgPercentMax()): string {
  return `${trainerFoundingPromoHeadline(trainerCap)} ${TRAINER_SIGNUP_CANNOT_SELL_UNTIL_COMPLETE}`;
}

/** Post-cap onboarding summary — fees shown at checkout when caps are reached. */
export function trainerStandardOnboardingAfterCapLabel(): string {
  return "background check through our portal plus card processing (as shown at checkout)";
}
