import { describe, expect, it } from "vitest";
import {
  ADMIN_FITPRO_TIER_CATEGORIES,
  adminFitProCategoryForTier,
  adminFitProPipelineCheckpointsForCategory,
} from "@/lib/admin-fitpro-tier-categories";

describe("admin-fitpro-tier-categories", () => {
  it("defines three FitPro pipeline categories", () => {
    expect(ADMIN_FITPRO_TIER_CATEGORIES.map((c) => c.id)).toEqual([
      "match_fit_pros",
      "independent_pros",
      "elite_pros",
    ]);
  });

  it("maps account tiers to categories", () => {
    expect(adminFitProCategoryForTier("match_fit_premium_pro")).toBe("match_fit_pros");
    expect(adminFitProCategoryForTier("independent_fitness_pro")).toBe("independent_pros");
    expect(adminFitProCategoryForTier("elite_fitness_pro")).toBe("elite_pros");
    expect(adminFitProCategoryForTier(null)).toBeNull();
  });

  it("uses tier-specific checkpoints", () => {
    const independent = adminFitProPipelineCheckpointsForCategory("independent_pros").map((c) => c.id);
    expect(independent).not.toContain("bg_submitted");
    expect(independent).toContain("monthly_subscription_active");

    const matchFit = adminFitProPipelineCheckpointsForCategory("match_fit_pros").map((c) => c.id);
    expect(matchFit).toContain("bg_submitted");
    expect(matchFit).toContain("premium_studio_enabled");
    expect(matchFit).not.toContain("monthly_subscription_active");
  });
});
