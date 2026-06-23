import type { FpAccountTier } from "@/lib/fp-account-tier-types";
import { FP_TIER_MONTHLY_FEES_USD } from "@/lib/fp-account-tier-types";

export const FP_INDEPENDENT_STRIPE_LOOKUP_KEY = "match_fit_independent_fp_monthly";
export const FP_ELITE_STRIPE_LOOKUP_KEY = "match_fit_elite_fp_monthly";
export const FP_PROMOTE_TOKEN_STRIPE_LOOKUP_KEY = "match_fit_fp_promote_token";

export const FP_INDEPENDENT_STRIPE_PRICE_ENV = "MATCH_FIT_INDEPENDENT_FP_STRIPE_PRICE_ID";
export const FP_ELITE_STRIPE_PRICE_ENV = "MATCH_FIT_ELITE_FP_STRIPE_PRICE_ID";
export const FP_PROMOTE_TOKEN_STRIPE_PRICE_ENV = "MATCH_FIT_FP_PROMOTE_TOKEN_STRIPE_PRICE_ID";

export const FP_STRIPE_CHECKOUT_PURPOSE = {
  independentSubscription: "fp_independent_subscription",
  eliteSubscription: "fp_elite_subscription",
  promoteTokenPurchase: "fp_promote_token_purchase",
} as const;

export function fpStripePriceEnvKeyForTier(tier: FpAccountTier): string | null {
  if (tier === "independent_fitness_pro") return FP_INDEPENDENT_STRIPE_PRICE_ENV;
  if (tier === "elite_fitness_pro") return FP_ELITE_STRIPE_PRICE_ENV;
  return null;
}

export function fpStripeLookupKeyForTier(tier: FpAccountTier): string | null {
  if (tier === "independent_fitness_pro") return FP_INDEPENDENT_STRIPE_LOOKUP_KEY;
  if (tier === "elite_fitness_pro") return FP_ELITE_STRIPE_LOOKUP_KEY;
  return null;
}

export function fpTierMonthlyFeeCents(tier: FpAccountTier): number | null {
  const usd = FP_TIER_MONTHLY_FEES_USD[tier];
  if (usd == null) return null;
  return Math.round(usd * 100);
}

export function fpStripeSubscriptionPurposeForTier(tier: FpAccountTier): string | null {
  if (tier === "independent_fitness_pro") return FP_STRIPE_CHECKOUT_PURPOSE.independentSubscription;
  if (tier === "elite_fitness_pro") return FP_STRIPE_CHECKOUT_PURPOSE.eliteSubscription;
  return null;
}
