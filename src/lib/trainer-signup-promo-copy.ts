/**
 * Shared Independent Pro / trainer signup promo constants and user-facing copy.
 * Keep marketing pages, legal text, signup flows, and dashboard banners aligned.
 */

import { getTrainerFoundingBgPercentMax } from "@/lib/match-fit-launch-promotion-caps";
import {
  TRAINER_PLATFORM_SUBSCRIPTION_USD,
  TRAINER_PLATFORM_TRIAL_DAYS,
  trainerPlatformSubscriptionLabel,
} from "@/lib/trainer-platform-trial-constants";

/** Complimentary Match Fit Premium Pro access included with the current beta Fitness Pro promo (aligned with Independent Pro trial days). */
export const TRAINER_SIGNUP_PREMIUM_PROMO_DAYS = TRAINER_PLATFORM_TRIAL_DAYS;

/** Fitness Pros must begin onboarding (background check + compliance steps) within this window after sign-up. */
export const TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS = 7;

export function trainerSignupPremiumPromoBenefitLabel(): string {
  return `${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days of Match Fit Premium Pro`;
}

export function trainerSignupOnboardingBeginDeadlineLabel(): string {
  return `${TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days`;
}

/** Verified Fit Pro paths eligible for founding background-check coverage (tiers that require a background check). */
export function trainerFoundingBgCheckEligibleTiersLabel(): string {
  return "Match Fit Pro, Match Fit Premium Pro, and Elite Fitness Pro";
}

/** Marketing line for platform-covered Checkr screening (founding cohort). */
export function trainerFoundingBgCheckBenefitLabel(): string {
  return "a fully covered background check from Match Fit — zero upfront screening cost";
}

/** Short label for promo bullets and feature rows. */
export function trainerFoundingBgCheckBenefitShortLabel(): string {
  return "Fully covered background check — zero upfront cost";
}

export function trainerIndependentProSubscriptionLabel(): string {
  return trainerPlatformSubscriptionLabel();
}

export function trainerIndependentProTrialBenefitLabel(): string {
  return `${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days free`;
}

export function trainerIndependentProTrialPromoSentence(): string {
  return `Independent Pros receive ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days free after registration. After the trial, keep your account active with the ${trainerIndependentProSubscriptionLabel()} subscription — you will be prompted for payment info whenever you log in once the trial ends.`;
}

/** One sentence explaining how the free-access period differs by tier (Fitness Pro vs Independent Pro vs Elite). */
export function trainerFoundingTierAccessBreakdownSentence(): string {
  return `Fitness Pros get ${trainerSignupPremiumPromoBenefitLabel()} at sign-up, Independent Pros get ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days of free listing access, and Elite Fitness Pros get both.`;
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

export { TRAINER_PLATFORM_SUBSCRIPTION_USD };
