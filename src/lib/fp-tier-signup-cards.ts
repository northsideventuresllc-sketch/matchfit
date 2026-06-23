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
      return "Full platform with in-app chat. Background check required.";
    case "match_fit_premium_pro":
      return "Match Fit Pro plus premium discovery and Fit Hub — in-app chat included.";
    case "independent_fitness_pro":
      return "Discovery nudges only (no in-app chat). Your brand and external site listed on Match Fit.";
    case "elite_fitness_pro":
      return "In-app chat plus unlimited nudges. External listings and business email allowed in chat.";
    default:
      return "";
  }
}

export function fpTierSignupCard(tier: FpAccountTier): FpTierCard {
  const card = FP_TIER_SIGNUP_CARDS.find((c) => c.tier === tier);
  if (!card) throw new Error(`Unknown tier: ${tier}`);
  return card;
}
