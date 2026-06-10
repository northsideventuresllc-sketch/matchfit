import { describe, expect, it } from "vitest";
import { parseTopOffering } from "@/lib/admin-portal-parsers";
import {
  computeMarketCompetitivenessProxy,
  computePlatformSuccessRating,
  daysSinceLaunch,
  PLATFORM_LAUNCH_DATE,
  PLATFORM_MARKETING_BUDGET_USD,
  PLATFORM_PERFORMANCE_GRACE_DAYS,
} from "@/lib/platform-success-rating";

describe("platform-success-rating", () => {
  it("returns zero score inputs as bounded 0-10 rating", () => {
    const result = computePlatformSuccessRating({
      daysSinceLaunch: 0,
      totalUsers: 0,
      activeUsers: 0,
      returningVisitorRatio: 0,
      revenuePerDayCents: 0,
      grossProfitMargin: 0,
      stabilityScore: 0,
      securityScore: 0,
      trainerPipelineCompletionRate: 0,
      subscriptionConversionRate: 0,
      marketCompetitiveness: 0,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.factors).toHaveLength(10);
    expect(result.meta.marketingBudgetUsd).toBe(PLATFORM_MARKETING_BUDGET_USD);
  });

  it("increases score with stronger operational signals after the grace window", () => {
    const weak = computePlatformSuccessRating({
      daysSinceLaunch: PLATFORM_PERFORMANCE_GRACE_DAYS,
      totalUsers: 10,
      activeUsers: 1,
      returningVisitorRatio: 0.1,
      revenuePerDayCents: 100,
      grossProfitMargin: 0.2,
      stabilityScore: 40,
      securityScore: 40,
      trainerPipelineCompletionRate: 0.1,
      subscriptionConversionRate: 0.05,
      marketCompetitiveness: 0.2,
    });
    const strong = computePlatformSuccessRating({
      daysSinceLaunch: PLATFORM_PERFORMANCE_GRACE_DAYS + 30,
      totalUsers: 100,
      activeUsers: 70,
      returningVisitorRatio: 0.5,
      revenuePerDayCents: 50000,
      grossProfitMargin: 0.6,
      stabilityScore: 90,
      securityScore: 85,
      trainerPipelineCompletionRate: 0.6,
      subscriptionConversionRate: 0.4,
      marketCompetitiveness: 0.7,
    });
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it("computes days since launch from fixed launch date", () => {
    const launchPlus7 = new Date(PLATFORM_LAUNCH_DATE.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(daysSinceLaunch(launchPlus7)).toBe(7);
  });

  it("is more forgiving during the 90-day performance grace window", () => {
    const weakPerformance = {
      daysSinceLaunch: 14,
      totalUsers: 10,
      activeUsers: 1,
      returningVisitorRatio: 0.02,
      revenuePerDayCents: 50,
      grossProfitMargin: 0.1,
      stabilityScore: 75,
      securityScore: 80,
      trainerPipelineCompletionRate: 0.05,
      subscriptionConversionRate: 0.02,
      marketCompetitiveness: 0.1,
    };
    const duringGrace = computePlatformSuccessRating(weakPerformance);
    const afterGrace = computePlatformSuccessRating({
      ...weakPerformance,
      daysSinceLaunch: PLATFORM_PERFORMANCE_GRACE_DAYS,
    });
    expect(duringGrace.score).toBeGreaterThan(afterGrace.score);
    expect(duringGrace.meta.performanceMetricsActive).toBe(false);
    expect(duringGrace.meta.performanceGraceDaysRemaining).toBe(PLATFORM_PERFORMANCE_GRACE_DAYS - 14);
    expect(afterGrace.meta.performanceMetricsActive).toBe(true);
  });

  it("computes market competitiveness proxy in 0-1 range", () => {
    const score = computeMarketCompetitivenessProxy({
      clientsTotal: 40,
      trainersTotal: 10,
      trainersLive: 6,
      featuredToday: 2,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("parseTopOffering", () => {
  it("reads title from service offerings JSON array", () => {
    expect(parseTopOffering(JSON.stringify([{ title: "8-session pack" }, { title: "Other" }]))).toBe("8-session pack");
  });

  it("returns null for invalid JSON", () => {
    expect(parseTopOffering("{not-json")).toBeNull();
    expect(parseTopOffering(null)).toBeNull();
  });
});
