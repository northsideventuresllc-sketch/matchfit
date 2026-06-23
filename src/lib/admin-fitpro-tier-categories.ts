import type { FpAccountTier } from "@/lib/fp-account-tier-types";
import { FP_TIER_DISPLAY_NAMES } from "@/lib/fp-account-tier-types";

/** Admin dashboard grouping for FitPro pipeline and activity panels. */
export const ADMIN_FITPRO_TIER_CATEGORIES = [
  {
    id: "match_fit_pros",
    label: "Match Fit Pros / Match Fit Premium Pros",
    tiers: ["match_fit_pro", "match_fit_premium_pro"] as const satisfies readonly FpAccountTier[],
  },
  {
    id: "independent_pros",
    label: "Independent Pros",
    tiers: ["independent_fitness_pro"] as const satisfies readonly FpAccountTier[],
  },
  {
    id: "elite_pros",
    label: "Elite Pros",
    tiers: ["elite_fitness_pro"] as const satisfies readonly FpAccountTier[],
  },
] as const;

export type AdminFitProTierCategoryId = (typeof ADMIN_FITPRO_TIER_CATEGORIES)[number]["id"];

export type AdminFitProTierCategory = (typeof ADMIN_FITPRO_TIER_CATEGORIES)[number];

export function adminFitProTiersForCategory(categoryId: AdminFitProTierCategoryId): FpAccountTier[] {
  const row = ADMIN_FITPRO_TIER_CATEGORIES.find((c) => c.id === categoryId);
  return row ? [...row.tiers] : [];
}

export function adminFitProCategoryForTier(tier: string | null | undefined): AdminFitProTierCategoryId | null {
  if (!tier) return null;
  for (const category of ADMIN_FITPRO_TIER_CATEGORIES) {
    if ((category.tiers as readonly string[]).includes(tier)) return category.id;
  }
  return null;
}

export function adminFitProTierShortLabel(tier: FpAccountTier): string {
  return FP_TIER_DISPLAY_NAMES[tier];
}

/** Checkpoint definitions shown inside each FitPro pipeline category collapsible. */
export type AdminFitProPipelineCheckpointId =
  | "pending_onboarding"
  | "onboarding_fee_incomplete"
  | "onboarding_fee_complete"
  | "bg_submitted"
  | "bg_review"
  | "bg_passed"
  | "fp_docs_pending"
  | "fp_docs_complete"
  | "monthly_subscription_pending"
  | "monthly_subscription_active"
  | "premium_studio_enabled"
  | "live";

export type AdminFitProPipelineCheckpointDef = {
  id: AdminFitProPipelineCheckpointId;
  label: string;
};

const CHECKPOINT_LABELS: Record<AdminFitProPipelineCheckpointId, string> = {
  pending_onboarding: "Pending onboarding",
  onboarding_fee_incomplete: "Onboarding fee not captured",
  onboarding_fee_complete: "Onboarding fee captured",
  bg_submitted: "Background check submitted/pending",
  bg_review: "Background check in review",
  bg_passed: "Background check passed",
  fp_docs_pending: "FP documents pending approval",
  fp_docs_complete: "FP documents approved",
  monthly_subscription_pending: "Monthly subscription pending",
  monthly_subscription_active: "Monthly subscription active",
  premium_studio_enabled: "Premium studio enabled",
  live: "Dashboard live",
};

const MATCH_FIT_PROS_CHECKPOINTS: AdminFitProPipelineCheckpointId[] = [
  "pending_onboarding",
  "onboarding_fee_incomplete",
  "onboarding_fee_complete",
  "bg_submitted",
  "bg_review",
  "bg_passed",
  "fp_docs_pending",
  "fp_docs_complete",
  "premium_studio_enabled",
  "live",
];

const INDEPENDENT_PROS_CHECKPOINTS: AdminFitProPipelineCheckpointId[] = [
  "pending_onboarding",
  "onboarding_fee_incomplete",
  "onboarding_fee_complete",
  "fp_docs_pending",
  "fp_docs_complete",
  "monthly_subscription_pending",
  "monthly_subscription_active",
  "live",
];

const ELITE_PROS_CHECKPOINTS: AdminFitProPipelineCheckpointId[] = [
  "pending_onboarding",
  "onboarding_fee_incomplete",
  "onboarding_fee_complete",
  "bg_submitted",
  "bg_review",
  "bg_passed",
  "fp_docs_pending",
  "fp_docs_complete",
  "monthly_subscription_pending",
  "monthly_subscription_active",
  "live",
];

export function adminFitProPipelineCheckpointsForCategory(
  categoryId: AdminFitProTierCategoryId,
): AdminFitProPipelineCheckpointDef[] {
  const ids =
    categoryId === "match_fit_pros"
      ? MATCH_FIT_PROS_CHECKPOINTS
      : categoryId === "independent_pros"
        ? INDEPENDENT_PROS_CHECKPOINTS
        : ELITE_PROS_CHECKPOINTS;
  return ids.map((id) => ({ id, label: CHECKPOINT_LABELS[id] }));
}
