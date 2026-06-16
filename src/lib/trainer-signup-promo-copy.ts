/**
 * Shared trainer signup promo constants and user-facing copy.
 * Keep marketing pages, legal text, signup flows, and dashboard banners aligned.
 */

import { getTrainerFoundingBgPercentMax } from "@/lib/match-fit-launch-promotion-caps";

/** Complimentary Premium Page access included with the current founding trainer promo. */
export const TRAINER_SIGNUP_PREMIUM_PROMO_DAYS = 60;

/** Trainers must begin onboarding (background check + compliance steps) within this window after sign-up. */
export const TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS = 7;

export function trainerSignupPremiumPromoBenefitLabel(): string {
  return `${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days of Premium status`;
}

export function trainerSignupOnboardingBeginDeadlineLabel(): string {
  return `${TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days`;
}

/** One sentence for hero / banner trainer promo bullets. */
export function trainerFoundingPromoHeadline(trainerCap = getTrainerFoundingBgPercentMax()): string {
  return `The first ${trainerCap} fitness professionals receive ${trainerSignupPremiumPromoBenefitLabel()} at sign-up, pay only their background check through our portal, and must begin onboarding within ${trainerSignupOnboardingBeginDeadlineLabel()} of creating an account.`;
}

/** Selling restriction repeated wherever trainers learn promo rules. */
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
