import type { FpAccountTier } from "@/lib/fp-account-tier-types";

export type FpAnalyticsTier = "basic" | "full";
export type FpTrustIndicator =
  | "verified"
  | "verified_premium"
  | "business_listed"
  | "verified_business";
export type FpSupportGroupType = "any" | "listing_tied";

export type FpTierPermissionSet = {
  background_check_required: boolean;
  monthly_fee: false | number;
  push_clients_offplatform: boolean;
  list_external_website: boolean;
  fithub_access: boolean;
  in_app_messaging: boolean;
  nudge_feature: boolean;
  run_promotions: boolean;
  featured_listing: boolean;
  analytics_tier: FpAnalyticsTier;
  waiver_intake_tools: boolean;
  appear_in_discovery: boolean;
  appear_in_recommended: boolean;
  badge: string;
  trust_indicator: FpTrustIndicator;
  platform_reviews: boolean;
  click_stats_public: boolean;
  promote_tokens_monthly: number;
  can_create_support_groups: boolean;
  support_group_type?: FpSupportGroupType;
};

const MATCH_FIT_PRO_PERMISSIONS: FpTierPermissionSet = {
  background_check_required: true,
  monthly_fee: false,
  push_clients_offplatform: false,
  list_external_website: false,
  fithub_access: true,
  in_app_messaging: true,
  nudge_feature: false,
  run_promotions: true,
  featured_listing: false,
  analytics_tier: "full",
  waiver_intake_tools: true,
  appear_in_discovery: true,
  appear_in_recommended: true,
  badge: "Match Fit Pro",
  trust_indicator: "verified",
  platform_reviews: true,
  click_stats_public: false,
  promote_tokens_monthly: 0,
  can_create_support_groups: true,
};

export const FP_PERMISSIONS: Record<FpAccountTier, FpTierPermissionSet> = {
  match_fit_pro: MATCH_FIT_PRO_PERMISSIONS,
  match_fit_premium_pro: {
    ...MATCH_FIT_PRO_PERMISSIONS,
    badge: "Match Fit Premium Pro",
    trust_indicator: "verified_premium",
    promote_tokens_monthly: 0,
    can_create_support_groups: true,
  },
  independent_fitness_pro: {
    background_check_required: false,
    monthly_fee: 15.0,
    push_clients_offplatform: true,
    list_external_website: true,
    fithub_access: true,
    in_app_messaging: false,
    nudge_feature: true,
    run_promotions: true,
    featured_listing: true,
    analytics_tier: "basic",
    waiver_intake_tools: false,
    appear_in_discovery: true,
    appear_in_recommended: true,
    badge: "Independent Pro",
    trust_indicator: "business_listed",
    platform_reviews: false,
    click_stats_public: true,
    promote_tokens_monthly: 5,
    can_create_support_groups: true,
    support_group_type: "listing_tied",
  },
  elite_fitness_pro: {
    background_check_required: true,
    monthly_fee: 40.0,
    push_clients_offplatform: true,
    list_external_website: true,
    fithub_access: true,
    in_app_messaging: true,
    nudge_feature: true,
    run_promotions: true,
    featured_listing: true,
    analytics_tier: "full",
    waiver_intake_tools: true,
    appear_in_discovery: true,
    appear_in_recommended: true,
    badge: "Elite Fitness Pro",
    trust_indicator: "verified_business",
    platform_reviews: true,
    click_stats_public: true,
    promote_tokens_monthly: 15,
    can_create_support_groups: true,
    support_group_type: "any",
  },
};

export function getFpTierPermissions(tier: FpAccountTier | null | undefined): FpTierPermissionSet | null {
  if (!tier) return null;
  return FP_PERMISSIONS[tier] ?? null;
}

export function fpTrustIndicatorLabel(indicator: FpTrustIndicator): string {
  switch (indicator) {
    case "verified":
      return "Verified";
    case "verified_premium":
      return "Verified Premium";
    case "business_listed":
      return "Business Listed";
    case "verified_business":
      return "Verified Business";
    default:
      return "Listed";
  }
}
