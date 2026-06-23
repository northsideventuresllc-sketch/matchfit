import { describe, expect, it } from "vitest";
import {
  FP_PREMIUM_PAGE_MONTHLY_USD,
  FP_SERVICE_CATALOGUE_DISCLAIMER,
  FP_TIER_MARKETING_GROUPS,
} from "@/lib/fp-tier-marketing-copy";
import { FP_TIER_DISPLAY_NAMES } from "@/lib/fp-account-tier-types";

describe("fp-tier-marketing-copy", () => {
  it("covers all four Fitness Pro account types", () => {
    const tiers = FP_TIER_MARKETING_GROUPS.flatMap((group) => group.tiers.map((t) => t.tier));
    expect(tiers).toEqual([
      "match_fit_pro",
      "match_fit_premium_pro",
      "independent_fitness_pro",
      "elite_fitness_pro",
    ]);
  });

  it("uses canonical display names for tier titles", () => {
    for (const group of FP_TIER_MARKETING_GROUPS) {
      for (const tier of group.tiers) {
        expect(tier.title).toBe(FP_TIER_DISPLAY_NAMES[tier.tier]);
      }
    }
  });

  it("groups Match Fit, Independent, and Elite paths", () => {
    expect(FP_TIER_MARKETING_GROUPS.map((g) => g.label)).toEqual([
      "Match Fit Pros",
      "Independent Pros",
      "Elite Pros",
    ]);
  });

  it("integrates Premium Page pricing into Match Fit Premium Pro bullets", () => {
    const premium = FP_TIER_MARKETING_GROUPS.flatMap((g) => g.tiers).find(
      (t) => t.tier === "match_fit_premium_pro",
    );
    expect(premium?.bullets.some((b) => b.includes(`$${FP_PREMIUM_PAGE_MONTHLY_USD}/month`))).toBe(true);
  });

  it("keeps tier bullets inclusion-focused", () => {
    const negativePatterns = [/not included/i, /not available/i, /does not/i, /remain prohibited/i, /no background/i];
    for (const group of FP_TIER_MARKETING_GROUPS) {
      for (const tier of group.tiers) {
        for (const bullet of tier.bullets) {
          for (const pattern of negativePatterns) {
            expect(bullet).not.toMatch(pattern);
          }
        }
      }
    }
  });

  it("scopes the service catalogue disclaimer to Match Fit Pros and Elite Pros", () => {
    expect(FP_SERVICE_CATALOGUE_DISCLAIMER).toMatch(/Match Fit Pros and Elite Pros/i);
  });
});
