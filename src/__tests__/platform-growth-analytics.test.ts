import { describe, expect, it } from "vitest";
import { computePlatformGrowthProjection } from "@/lib/platform-growth-projection";
import { computePlatformPotentialRating } from "@/lib/platform-potential-rating";
import { computePlatformSuccessRating } from "@/lib/platform-success-rating";

const baseInput = {
  daysSinceLaunch: 14,
  totalUsers: 50,
  activeUsers: 18,
  returningVisitorRatio: 0.08,
  revenuePerDayCents: 1200,
  grossProfitMargin: 0.35,
  stabilityScore: 72,
  securityScore: 78,
  trainerPipelineCompletionRate: 0.22,
  subscriptionConversionRate: 0.06,
  marketCompetitiveness: 0.35,
};

describe("platform-potential-rating", () => {
  it("scores at or above current success rating", () => {
    const success = computePlatformSuccessRating(baseInput);
    const potential = computePlatformPotentialRating(baseInput);
    expect(potential.score).toBeGreaterThanOrEqual(success.score);
    expect(potential.successScore).toBe(success.score);
    expect(potential.uplift).toBeGreaterThanOrEqual(0);
    expect(potential.recommendations.length).toBeGreaterThan(0);
  });
});

describe("platform-growth-projection", () => {
  it("returns bounded valuation and revenue projections", () => {
    const projection = computePlatformGrowthProjection({
      activeClientSubscriptions: 4,
      premiumTrainers: 1,
      clientsInFreeTrial: 3,
      clientsWithCard: 6,
      revenue30dCents: 45000,
      grossProfit30dCents: 22000,
      uniqueVisitors30d: 180,
      clientSignupPageViews7d: 24,
      pendingClientRegistrations: 2,
      daysSinceLaunch: 14,
    });
    expect(projection.realisticMonthlyRevenueCents).toBeGreaterThan(0);
    expect(projection.valuationMidCents).toBeGreaterThan(projection.valuationLowCents);
    expect(projection.valuationHighCents).toBeGreaterThan(projection.valuationMidCents);
    expect(projection.revenueRecommendations.length).toBeGreaterThan(0);
  });
});
