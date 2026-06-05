import { describe, expect, it } from "vitest";
import { computePlatformValuation } from "@/lib/platform-valuation";
import { computePotentialSuccessScore } from "@/lib/platform-potential-success";

describe("platform-valuation", () => {
  it("returns higher valuation with more subscribers and stronger success score", () => {
    const low = computePlatformValuation({
      activePlatformSubscribers: 2,
      activeTrainerPremiumSubscribers: 1,
      grossProfit30dCents: 5000,
      activeUsers: 10,
      successScore: 2,
    });
    const high = computePlatformValuation({
      activePlatformSubscribers: 40,
      activeTrainerPremiumSubscribers: 12,
      grossProfit30dCents: 250000,
      activeUsers: 120,
      successScore: 8,
    });
    expect(high.valuationCents).toBeGreaterThan(low.valuationCents);
    expect(high.revenueMultiple).toBeGreaterThan(low.revenueMultiple);
  });
});

describe("platform-potential-success", () => {
  it("projects potential score at or above current score", () => {
    const result = computePotentialSuccessScore({
      daysSinceLaunch: 10,
      totalUsers: 30,
      activeUsers: 12,
      returningVisitorRatio: 0.2,
      revenuePerDayCents: 1500,
      grossProfitMargin: 0.35,
      stabilityScore: 70,
      securityScore: 65,
      trainerPipelineCompletionRate: 0.3,
      subscriptionConversionRate: 0.15,
      marketCompetitiveness: 0.4,
      revenue30dCents: 45000,
    });
    expect(result.score).toBeGreaterThanOrEqual(result.currentScore);
    expect(result.uplift).toBeGreaterThanOrEqual(0);
    expect(result.assumptions.length).toBeGreaterThan(0);
  });
});
