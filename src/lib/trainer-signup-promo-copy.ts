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

/** Complimentary Independent Pro platform access included with BETA signup. */
export const TRAINER_SIGNUP_PREMIUM_PROMO_DAYS = TRAINER_PLATFORM_TRIAL_DAYS;

/** Trainers must begin onboarding (background check + compliance steps) within this window after sign-up. */
export const TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS = 7;

export function trainerSignupPremiumPromoBenefitLabel(): string {
  return `${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days free`;
}

export function trainerSignupOnboardingBeginDeadlineLabel(): string {
  return `${TRAINER_SIGNUP_ONBOARDING_BEGIN_DAYS} days`;
}

export function trainerIndependentProSubscriptionLabel(): string {
  return trainerPlatformSubscriptionLabel();
}

export function trainerIndependentProTrialPromoSentence(): string {
  return `Independent Pros receive ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days free after registration. After the trial, keep your account active with the ${trainerIndependentProSubscriptionLabel()} subscription — you will be prompted for payment info whenever you log in once the trial ends.`;
}

/** One sentence for hero / banner trainer promo bullets (founding BG cohort + free trial). */
export function trainerFoundingPromoHeadline(trainerCap = getTrainerFoundingBgPercentMax()): string {
  return `The first ${trainerCap} fitness professionals pay only their background check through our portal, receive ${trainerSignupPremiumPromoBenefitLabel()} of Independent Pro access at sign-up, and must begin onboarding within ${trainerSignupOnboardingBeginDeadlineLabel()} of creating an account. After the free period, the ${trainerIndependentProSubscriptionLabel()} subscription keeps the account active.`;
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

export { TRAINER_PLATFORM_SUBSCRIPTION_USD };
