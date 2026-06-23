import {
  FP_TIER_DISPLAY_NAMES,
  FP_TIER_MONTHLY_FEES_USD,
  type FpAccountTier,
} from "@/lib/fp-account-tier-types";
import { INDEPENDENT_FP_DAILY_NUDGES, FP_NUDGE_PACK_PRICE_USD, FP_NUDGE_PACK_SIZE } from "@/lib/fp-tier-chat-policy";
import { TRAINER_SIGNUP_PREMIUM_PROMO_DAYS } from "@/lib/trainer-signup-promo-copy";

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

export const FP_TIER_MARKETING_GROUPS: readonly FpTierMarketingGroup[] = [
  {
    id: "match_fit_pros",
    label: "Match Fit Pros",
    description:
      "Coaches who train fully on Match Fit — in-app chat, Fit Hub, platform reviews, and standard on-platform communication rules.",
    tiers: [
      {
        tier: "match_fit_pro",
        title: FP_TIER_DISPLAY_NAMES.match_fit_pro,
        feeLabel: matchFitProFeeLabel(),
        summary: "The standard Match Fit coach path with full platform tools and background screening.",
        bullets: [
          "In-app chat for client outreach — discovery nudges are not included.",
          "Fit Hub publishing, platform reviews, and verified trust indicators.",
          "Background check required before you appear publicly.",
        ],
      },
      {
        tier: "match_fit_premium_pro",
        title: FP_TIER_DISPLAY_NAMES.match_fit_premium_pro,
        feeLabel: `Platform % per session · ${TRAINER_SIGNUP_PREMIUM_PROMO_DAYS} days complimentary during beta`,
        summary:
          "Everything in Match Fit Pro plus premium discovery visibility, featured-placement programs, and expanded Fit Hub tools.",
        bullets: [
          "In-app chat under the same communication rules as Match Fit Pro.",
          "Premium discovery surfacing and regional featured-placement eligibility.",
          "During beta, founding Fitness Pros start here at no cost for 60 days.",
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
          "Discovery nudges only — in-app chat is not available on this account type.",
        bullets: [
          `${INDEPENDENT_FP_DAILY_NUDGES} discovery nudges per day (UTC), with optional ${FP_NUDGE_PACK_SIZE}-nudge packs for $${FP_NUDGE_PACK_PRICE_USD.toFixed(2)}.`,
          "List your external website and appear with business-listed trust indicators.",
          "No background check required for this tier.",
        ],
      },
    ],
  },
  {
    id: "elite_pros",
    label: "Elite Pros",
    description:
      "Established coaches who want Match Fit chat plus unlimited discovery nudges and flexible off-platform brand links.",
    tiers: [
      {
        tier: "elite_fitness_pro",
        title: FP_TIER_DISPLAY_NAMES.elite_fitness_pro,
        feeLabel: monthlyFeeLabel("elite_fitness_pro"),
        summary:
          "In-app chat plus unlimited discovery nudges, with expanded chat permissions for business contact.",
        bullets: [
          "Unlimited discovery nudges and full in-app chat.",
          "Business email addresses and external listing links may be shared in chat.",
          "Phone numbers and off-platform payment details remain prohibited.",
        ],
      },
    ],
  },
];

/** Optional legacy Premium Page add-on (separate from account type). */
export const FP_PREMIUM_PAGE_MARKETING = {
  title: "Optional Premium Page Add-On",
  feeLabel: "$20/month",
  summary:
    "Separate from your Fitness Pro account type, the Premium Page unlocks the Premium Hub — featured placement tools, FitHub publishing studio, and promotion tokens for coaches who want extra visibility workflow.",
  bullets: [
    "Featured Fitness Pro placement programs and promotion tokens.",
    "FitHub publishing studio controls beyond your tier defaults where applicable.",
    "Account types above already include tier-specific chat, discovery, and Fit Hub access — Premium Page is an additional upgrade.",
  ] as const,
};

export const FP_TIER_MARKETING_BETA_NOTE =
  "During beta, Match Fit Pro is not offered at signup. Founding Fitness Pros start on Match Fit Premium Pro.";
