import {
  FP_TIER_DISPLAY_NAMES,
  FP_TIER_MONTHLY_FEES_USD,
  type FpAccountTier,
} from "@/lib/fp-account-tier-types";
import { INDEPENDENT_FP_DAILY_NUDGES, FP_NUDGE_PACK_PRICE_USD, FP_NUDGE_PACK_SIZE } from "@/lib/fp-tier-chat-policy";
import { TRAINER_SIGNUP_PREMIUM_PROMO_DAYS } from "@/lib/trainer-signup-promo-copy";

export const FP_PREMIUM_PAGE_MONTHLY_USD = 20;

export type FpTierMarketingCard = {
  tier: FpAccountTier;
  title: string;
  feeLabel: string;
  summary: string;
  bullets: readonly string[];
};

export type FpTierMarketingGroup = {
  id: "match_fit_pros" | "independent_pros" | "elite_pros";
  label: string;
  description: string;
  tiers: readonly FpTierMarketingCard[];
};

function matchFitProFeeLabel(): string {
  return "Platform % per session · no monthly tier fee";
}

function monthlyFeeLabel(tier: FpAccountTier): string {
  const monthly = FP_TIER_MONTHLY_FEES_USD[tier];
  return monthly != null ? `$${monthly}/month` : matchFitProFeeLabel();
}

export const FP_SERVICE_CATALOGUE_DISCLAIMER =
  "This service catalogue applies to Match Fit Pros and Elite Pros. Templates and checkout flows may differ by account type.";

export const FP_TIER_MARKETING_GROUPS: readonly FpTierMarketingGroup[] = [
  {
    id: "match_fit_pros",
    label: "Match Fit Pros",
    description:
      "Coaches who train fully on Match Fit — in-app chat, Fit Hub, platform reviews, and verified listing on the marketplace.",
    tiers: [
      {
        tier: "match_fit_pro",
        title: FP_TIER_DISPLAY_NAMES.match_fit_pro,
        feeLabel: matchFitProFeeLabel(),
        summary: "The standard Match Fit coach path with full platform tools and verified public listing.",
        bullets: [
          "In-app chat for client outreach, scheduling, and session coordination.",
          "Fit Hub publishing and platform reviews on your public profile.",
          "Verified trust badge and full discovery listing after screening approval.",
          "Interest clients workflow when someone swipes right on your profile.",
        ],
      },
      {
        tier: "match_fit_premium_pro",
        title: FP_TIER_DISPLAY_NAMES.match_fit_premium_pro,
        feeLabel: `Platform % per session · ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days complimentary during beta`,
        summary:
          "Everything in Match Fit Pro plus premium discovery visibility, featured-placement programs, and optional Premium Page tools.",
        bullets: [
          "Everything included in Match Fit Pro.",
          "Premium discovery surfacing and regional featured-placement program eligibility.",
          "Verified Premium trust badge and expanded Fit Hub visibility.",
          `Optional Premium Page add-on at $${FP_PREMIUM_PAGE_MONTHLY_USD}/month — Premium Hub with featured placement tools, FitHub publishing studio, and promotion tokens.`,
          `Founding beta coaches start here with ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days complimentary on this tier.`,
        ],
      },
    ],
  },
  {
    id: "independent_pros",
    label: "Independent Pros",
    description:
      "Coaches who want Match Fit discovery while keeping their own brand and external presence front and center.",
    tiers: [
      {
        tier: "independent_fitness_pro",
        title: FP_TIER_DISPLAY_NAMES.independent_fitness_pro,
        feeLabel: monthlyFeeLabel("independent_fitness_pro"),
        summary:
          "Discovery-first outreach with your external brand listed alongside your Match Fit profile.",
        bullets: [
          `${INDEPENDENT_FP_DAILY_NUDGES} discovery nudges per day (UTC) to reach opted-in clients, with optional ${FP_NUDGE_PACK_SIZE}-nudge packs for $${FP_NUDGE_PACK_PRICE_USD.toFixed(2)}.`,
          "External website on your public profile with business-listed trust indicators.",
          "Fit Hub publishing, featured listing tools, and regional discovery placement.",
          "Monthly platform subscription with streamlined document onboarding.",
        ],
      },
    ],
  },
  {
    id: "elite_pros",
    label: "Elite Pros",
    description:
      "Established coaches who want Match Fit chat, unlimited discovery nudges, and flexible brand links in conversation.",
    tiers: [
      {
        tier: "elite_fitness_pro",
        title: FP_TIER_DISPLAY_NAMES.elite_fitness_pro,
        feeLabel: monthlyFeeLabel("elite_fitness_pro"),
        summary:
          "Full in-app chat plus unlimited discovery nudges, with expanded brand tools for established businesses.",
        bullets: [
          "Full in-app chat plus unlimited discovery nudges for client outreach.",
          "Business email addresses in chat for brand continuity.",
          "Verified business trust badge with full analytics, waiver tools, and promotion tokens.",
          "Fit Hub, featured listing programs, and platform reviews on your public profile.",
        ],
      },
    ],
  },
];

export const FP_TIER_MARKETING_BETA_NOTE =
  "During beta, Match Fit Pro is not offered at signup. Founding Fitness Pros start on Match Fit Premium Pro.";
