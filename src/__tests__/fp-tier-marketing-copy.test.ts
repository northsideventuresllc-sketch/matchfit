import { describe, expect, it } from "vitest";
import {
  FP_PREMIUM_PAGE_MARKETING,
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

  it("separates Premium Page from account tiers", () => {
    expect(FP_PREMIUM_PAGE_MARKETING.feeLabel).toContain("$20");
    expect(FP_PREMIUM_PAGE_MARKETING.summary).toMatch(/separate from your Fitness Pro account type/i);
  });
});
