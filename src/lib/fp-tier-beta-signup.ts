import { isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";
import type { FpAccountTier } from "@/lib/fp-account-tier-types";
import { fpTierRequiresMonthlyFee } from "@/lib/fp-account-tier-types";
import { FP_TIER_SIGNUP_CARDS, type FpTierCard } from "@/lib/fp-tier-signup-cards";
import { TRAINER_SIGNUP_PREMIUM_PROMO_DAYS } from "@/lib/trainer-signup-promo-copy";

export const FP_BETA_PREMIUM_PRO_STICKER =
  "60 DAYS OF PREMIUM PRO FREE FOR BETA USERS";

export const FP_BETA_DEFAULT_TIER: FpAccountTier = "match_fit_premium_pro";

export function fpBetaSignupActive(): boolean {
  return isBetaLaunchGatesEnabled();
}

export function fpTierSelectableDuringBeta(tier: FpAccountTier): boolean {
  if (!fpBetaSignupActive()) return true;
  if (tier === "match_fit_premium_pro") return true;
  if (tier === "independent_fitness_pro" || tier === "elite_fitness_pro") return true;
  return false;
}

export function fpTierRequiresPaidSubscriptionDuringBeta(tier: FpAccountTier): boolean {
  if (!fpBetaSignupActive()) return fpTierRequiresMonthlyFee(tier);
  return tier === "independent_fitness_pro" || tier === "elite_fitness_pro";
}

export function fpBetaPremiumPromoEndsAt(from = new Date()): Date {
  const ends = new Date(from);
  ends.setUTCDate(ends.getUTCDate() + TRAINER_SIGNUP_PREMIUM_PROMO_DAYS);
  return ends;
}

/** Cards shown on signup tier step (beta hides complimentary Match Fit Pro). */
export function fpTierSignupCardsForDisplay(): readonly FpTierCard[] {
  if (!fpBetaSignupActive()) return FP_TIER_SIGNUP_CARDS;
  return FP_TIER_SIGNUP_CARDS.filter((card) => fpTierSelectableDuringBeta(card.tier));
}
