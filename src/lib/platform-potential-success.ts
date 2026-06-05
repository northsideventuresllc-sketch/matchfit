/**
 * Potential success score (0–10) — forward-looking projection for the admin dashboard.
 *
 * Re-runs the platform success rating model with optimistic-but-bounded beta targets
 * (pipeline completion, subscription conversion, retention, and revenue ramp).
 */

import {
  computePlatformSuccessRating,
  type PlatformSuccessRatingBreakdown,
  type PlatformSuccessRatingInput,
} from "@/lib/platform-success-rating";

export type PlatformPotentialSuccessInput = PlatformSuccessRatingInput & {
  revenue30dCents?: number;
};

export type PlatformPotentialSuccessBreakdown = {
  score: number;
  currentScore: number;
  uplift: number;
  successRating: PlatformSuccessRatingBreakdown;
  assumptions: string[];
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function projectRevenuePerDayCents(input: PlatformPotentialSuccessInput): number {
  const current = Math.max(0, input.revenuePerDayCents);
  const from30d =
    input.revenue30dCents && input.revenue30dCents > 0 ? Math.round(input.revenue30dCents / 30) : 0;
  const trendBoost = from30d > current ? Math.round(from30d * 1.15) : Math.round(current * 1.25);
  return Math.max(current, trendBoost, 500);
}

export function computePotentialSuccessScore(input: PlatformPotentialSuccessInput): PlatformPotentialSuccessBreakdown {
  const current = computePlatformSuccessRating(input);

  const projected: PlatformSuccessRatingInput = {
    daysSinceLaunch: Math.max(input.daysSinceLaunch, 90),
    totalUsers: input.totalUsers,
    activeUsers: input.totalUsers > 0 ? Math.min(input.totalUsers, Math.round(input.activeUsers * 1.35)) : 0,
    returningVisitorRatio: clamp01(input.returningVisitorRatio * 1.3 + 0.1),
    revenuePerDayCents: projectRevenuePerDayCents(input),
    grossProfitMargin: clamp01(Math.max(input.grossProfitMargin, 0.45)),
    stabilityScore: Math.min(100, input.stabilityScore + 8),
    securityScore: Math.min(100, input.securityScore + 5),
    trainerPipelineCompletionRate: clamp01(input.trainerPipelineCompletionRate * 1.4 + 0.15),
    subscriptionConversionRate: clamp01(input.subscriptionConversionRate * 1.75 + 0.08),
    marketCompetitiveness: clamp01(input.marketCompetitiveness * 1.2 + 0.05),
  };

  const potential = computePlatformSuccessRating(projected);
  const score = Math.max(current.score, potential.score);
  const uplift = Math.round((score - current.score) * 10) / 10;

  return {
    score,
    currentScore: current.score,
    uplift,
    successRating: potential,
    assumptions: [
      "90-day maturity ramp for launch factor",
      "35% active-user uplift at full engagement",
      "Pipeline and subscription conversion at realistic beta ceilings",
      "30d revenue trend projected forward with 15–25% growth headroom",
    ],
  };
}
