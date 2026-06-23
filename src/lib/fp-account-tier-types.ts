/** Fitness Pro account tier keys (stored on `TrainerProfile.accountTier`). */
export const FP_ACCOUNT_TIERS = [
  "match_fit_pro",
  "match_fit_premium_pro",
  "independent_fitness_pro",
  "elite_fitness_pro",
] as const;

export type FpAccountTier = (typeof FP_ACCOUNT_TIERS)[number];

export const FP_LISTING_STATUSES = [
  "active",
  "paused",
  "suspended",
  "pending_docs",
  "pending_background",
] as const;

export type FpListingStatus = (typeof FP_LISTING_STATUSES)[number];

export const FP_DOC_TYPES = [
  "business_registration",
  "liability_insurance",
  "professional_certification",
  "facility_proof",
  "headshot",
  "business_logo",
] as const;

export type FpDocType = (typeof FP_DOC_TYPES)[number];

export const FP_DOC_STATUSES = ["pending", "approved", "rejected"] as const;
export type FpDocStatus = (typeof FP_DOC_STATUSES)[number];

export const FP_PROMOTE_TOKEN_ACTIONS = ["credited", "spent", "purchased", "expired"] as const;
export type FpPromoteTokenAction = (typeof FP_PROMOTE_TOKEN_ACTIONS)[number];

export const FP_FEATURED_REGION_TIERS = ["zip_cluster", "metro", "statewide"] as const;
export type FpFeaturedRegionTier = (typeof FP_FEATURED_REGION_TIERS)[number];

export const ELITE_DASHBOARD_VIEW_MODES = ["match_fit_pro", "independent_fitness_pro"] as const;
export type EliteDashboardViewMode = (typeof ELITE_DASHBOARD_VIEW_MODES)[number];

export const FP_TIER_DISPLAY_NAMES: Record<FpAccountTier, string> = {
  match_fit_pro: "Match Fit Pro",
  match_fit_premium_pro: "Match Fit Premium Pro",
  independent_fitness_pro: "Independent Fitness Pro",
  elite_fitness_pro: "Elite Fitness Pro",
};

export const FP_TIER_MONTHLY_FEES_USD: Partial<Record<FpAccountTier, number>> = {
  independent_fitness_pro: 15,
  elite_fitness_pro: 40,
};

export const FP_TIER_SWITCH_LOCK_DAYS = 28;
export const FP_DOCS_MAX_REJECTIONS_PER_24H = 10;
export const FP_LISTING_PAUSE_MAX_DAYS = 30;
export const FP_BILLING_GRACE_HOURS = 72;
export const FP_PROMOTE_TOKEN_USD = 2;
export const FP_FEATURED_LISTING_CAPS: Record<FpFeaturedRegionTier, number> = {
  zip_cluster: 3,
  metro: 5,
  statewide: 8,
};

export function isFpAccountTier(value: string | null | undefined): value is FpAccountTier {
  return FP_ACCOUNT_TIERS.includes(value as FpAccountTier);
}

export function fpTierRequiresMonthlyFee(tier: FpAccountTier): boolean {
  return tier === "independent_fitness_pro" || tier === "elite_fitness_pro";
}

export function fpTierRequiresBackgroundCheck(tier: FpAccountTier): boolean {
  return tier !== "independent_fitness_pro";
}
