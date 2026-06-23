import {
  FP_ACCOUNT_TIERS,
  FP_TIER_DISPLAY_NAMES,
  FP_TIER_MONTHLY_FEES_USD,
  fpTierRequiresBackgroundCheck,
  type FpAccountTier,
} from "@/lib/fp-account-tier-types";

export type FpTierCard = {
  tier: FpAccountTier;
  title: string;
  subtitle: string;
  feeLabel: string;
  backgroundCheck: boolean;
};

export const FP_TIER_SIGNUP_CARDS: readonly FpTierCard[] = FP_ACCOUNT_TIERS.map((tier) => {
  const monthly = FP_TIER_MONTHLY_FEES_USD[tier];
  return {
    tier,
    title: FP_TIER_DISPLAY_NAMES[tier],
    subtitle: fpTierSignupSubtitle(tier),
    feeLabel:
      monthly != null
        ? `$${monthly}/mo`
        : "Platform % per session",
    backgroundCheck: fpTierRequiresBackgroundCheck(tier),
  };
});

function fpTierSignupSubtitle(tier: FpAccountTier): string {
  switch (tier) {
    case "match_fit_pro":
      return "Full platform. Background check required.";
    case "match_fit_premium_pro":
      return "Pro plus premium visibility.";
    case "independent_fitness_pro":
      return "Your brand, your site, listed on Match Fit.";
    case "elite_fitness_pro":
      return "Everything combined.";
    default:
      return "";
  }
}

export function fpTierSignupCard(tier: FpAccountTier): FpTierCard {
  const card = FP_TIER_SIGNUP_CARDS.find((c) => c.tier === tier);
  if (!card) throw new Error(`Unknown tier: ${tier}`);
  return card;
}
