/**
 * Potential rating (0–10 range): unified forward-looking score for the admin dashboard.
 *
 * Merges the former "potential success" and "potential rating" models into one metric
 * expressed as a conservative-to-optimistic range using scenario inputs.
 */

import {
  computePlatformSuccessRating,
  type PlatformSuccessRatingBreakdown,
  type PlatformSuccessRatingInput,
} from "@/lib/platform-success-rating";

export type GrowthRecommendation = {
  id: string;
  label: string;
  action: string;
  impact: "high" | "medium" | "low";
};

export type PlatformPotentialScenario = {
  id: "conservative" | "optimistic";
  label: string;
  score: number;
  assumptions: string[];
};

export type PlatformPotentialRatingInput = PlatformSuccessRatingInput & {
  revenue30dCents?: number;
};

export type PlatformPotentialRatingBreakdown = {
  /** Absolute lowest realistic score (stagnation / friction scenario). */
  scoreLow: number;
  /** Absolute highest realistic score (optimized levers at stage ceiling). */
  scoreHigh: number;
  currentScore: number;
  scenarios: PlatformPotentialScenario[];
  optimizedFactors: {
    id: string;
    label: string;
    currentRaw: number;
    targetRaw: number;
    gapLabel: string;
  }[];
  recommendations: GrowthRecommendation[];
  assumptions: string[];
  meta: PlatformSuccessRatingBreakdown["meta"];
};

type StageTargets = {
  returningVisitorRatio: number;
  revenuePerDayUsd: number;
  grossProfitMargin: number;
  stabilityScore: number;
  securityScore: number;
  trainerPipelineCompletionRate: number;
  subscriptionConversionRate: number;
  marketCompetitiveness: number;
  activeUserRatio: number;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function stageTargets(daysSinceLaunch: number): StageTargets {
  const ramp = Math.min(1, daysSinceLaunch / 90);
  return {
    returningVisitorRatio: 0.12 + ramp * 0.23,
    revenuePerDayUsd: 8 + ramp * 42,
    grossProfitMargin: 0.42,
    stabilityScore: 86,
    securityScore: 88,
    trainerPipelineCompletionRate: 0.3 + ramp * 0.3,
    subscriptionConversionRate: 0.1 + ramp * 0.12,
    marketCompetitiveness: 0.5 + ramp * 0.28,
    activeUserRatio: 0.35 + ramp * 0.35,
  };
}

function projectRevenuePerDayCents(input: PlatformPotentialRatingInput): number {
  const current = Math.max(0, input.revenuePerDayCents);
  const from30d =
    input.revenue30dCents && input.revenue30dCents > 0 ? Math.round(input.revenue30dCents / 30) : 0;
  const trendBoost = from30d > current ? Math.round(from30d * 1.15) : Math.round(current * 1.25);
  return Math.max(current, trendBoost, 500);
}

/** Stagnation scenario — growth stalls, onboarding friction persists, no lever improvements. */
function buildConservativeScenarioInput(input: PlatformPotentialRatingInput): PlatformSuccessRatingInput {
  return {
    ...input,
    activeUsers: Math.max(0, Math.round(input.activeUsers * 0.82)),
    returningVisitorRatio: clamp01(input.returningVisitorRatio * 0.72),
    revenuePerDayCents: Math.max(0, Math.round(input.revenuePerDayCents * 0.72)),
    grossProfitMargin: clamp01(input.grossProfitMargin * 0.9),
    stabilityScore: Math.max(0, input.stabilityScore - 6),
    securityScore: Math.max(0, input.securityScore - 4),
    trainerPipelineCompletionRate: clamp01(input.trainerPipelineCompletionRate * 0.8),
    subscriptionConversionRate: clamp01(input.subscriptionConversionRate * 0.78),
    marketCompetitiveness: clamp01(input.marketCompetitiveness * 0.88),
  };
}

/** Stage-target scenario — key levers reach realistic targets for the current launch window. */
function buildStageOptimizedInput(
  input: PlatformPotentialRatingInput,
  targets: StageTargets,
): PlatformSuccessRatingInput {
  const optimizedActiveUsers = Math.max(
    input.activeUsers,
    Math.round(input.totalUsers * targets.activeUserRatio),
  );

  return {
    ...input,
    daysSinceLaunch: Math.max(input.daysSinceLaunch, 90),
    activeUsers: optimizedActiveUsers,
    returningVisitorRatio: Math.max(input.returningVisitorRatio, targets.returningVisitorRatio),
    revenuePerDayCents: Math.max(input.revenuePerDayCents, targets.revenuePerDayUsd * 100),
    grossProfitMargin: Math.max(input.grossProfitMargin, targets.grossProfitMargin),
    stabilityScore: Math.max(input.stabilityScore, targets.stabilityScore),
    securityScore: Math.max(input.securityScore, targets.securityScore),
    trainerPipelineCompletionRate: Math.max(
      input.trainerPipelineCompletionRate,
      targets.trainerPipelineCompletionRate,
    ),
    subscriptionConversionRate: Math.max(
      input.subscriptionConversionRate,
      targets.subscriptionConversionRate,
    ),
    marketCompetitiveness: Math.max(input.marketCompetitiveness, targets.marketCompetitiveness),
  };
}

/** Beta-ceiling scenario — optimistic engagement and revenue ramp with bounded beta ceilings. */
function buildBetaCeilingInput(input: PlatformPotentialRatingInput): PlatformSuccessRatingInput {
  return {
    ...input,
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
}

function recommendationForFactor(
  id: string,
  gapLabel: string,
): GrowthRecommendation | null {
  const map: Record<string, Omit<GrowthRecommendation, "id">> = {
    retention: {
      label: "Improve return visits",
      action:
        "Send a weekly digest to clients and trainers, add a post-login dashboard checklist, and retarget visitors who viewed signup but did not register.",
      impact: "high",
    },
    revenue_per_day: {
      label: "Grow monetized activity",
      action:
        "Promote trainer offerings on the homepage, nudge trial clients before expiry, and spotlight trainers with open booking slots in Fit Hub.",
      impact: "high",
    },
    stability: {
      label: "Reduce production friction",
      action:
        "Triage open operational alerts, run smoke tests on signup and checkout weekly, and fix the top user-reported friction paths before scaling ads.",
      impact: "high",
    },
    security: {
      label: "Tighten trust signals",
      action:
        "Resolve pending safety or billing alerts, keep background-check statuses current, and surface trust badges near signup CTAs.",
      impact: "medium",
    },
    trainer_pipeline: {
      label: "Finish trainer onboarding",
      action:
        "Email trainers stuck before background check or dashboard activation with a single next-step link and deadline reminder.",
      impact: "high",
    },
    subscription: {
      label: "Convert trials to paid",
      action:
        "Add in-app reminders during the free trial, clarify value on the subscribe step, and follow up with clients who added a card but have not subscribed.",
      impact: "high",
    },
    market: {
      label: "Balance supply and demand",
      action:
        "Recruit trainers in zip codes with client demand, fill featured slots daily, and keep at least one live trainer per active client cluster.",
      impact: "medium",
    },
    active_ratio: {
      label: "Re-engage dormant accounts",
      action:
        "Identify clients and trainers inactive for 14+ days and send a personalized re-entry prompt tied to their last action.",
      impact: "medium",
    },
    maturity: {
      label: "Sustain launch momentum",
      action:
        "Keep a simple weekly growth cadence: one traffic experiment, one funnel fix, and one retention touchpoint.",
      impact: "low",
    },
  };
  const base = map[id];
  if (!base) return null;
  return { id, ...base, label: gapLabel ? `${base.label} (${gapLabel})` : base.label };
}

export function computePlatformPotentialRating(
  input: PlatformPotentialRatingInput,
): PlatformPotentialRatingBreakdown {
  const success = computePlatformSuccessRating(input);
  const targets = stageTargets(input.daysSinceLaunch);

  const conservativeScore = computePlatformSuccessRating(buildConservativeScenarioInput(input)).score;
  const stageOptimizedScore = computePlatformSuccessRating(buildStageOptimizedInput(input, targets)).score;
  const betaCeilingScore = computePlatformSuccessRating(buildBetaCeilingInput(input)).score;
  const optimisticScore = Math.max(stageOptimizedScore, betaCeilingScore);

  const scoreLow = Math.round(Math.min(conservativeScore, optimisticScore, success.score) * 10) / 10;
  const scoreHigh = Math.round(Math.max(conservativeScore, optimisticScore, success.score) * 10) / 10;

  const activeRatio = input.totalUsers > 0 ? input.activeUsers / input.totalUsers : 0;
  const rawChecks: {
    id: string;
    label: string;
    current: number;
    target: number;
    format: (n: number) => string;
  }[] = [
    {
      id: "retention",
      label: "Returning visitor ratio",
      current: input.returningVisitorRatio,
      target: targets.returningVisitorRatio,
      format: (n) => `${(n * 100).toFixed(0)}%`,
    },
    {
      id: "revenue_per_day",
      label: "Revenue per day",
      current: input.revenuePerDayCents / 100,
      target: targets.revenuePerDayUsd,
      format: (n) => `$${n.toFixed(0)}`,
    },
    {
      id: "stability",
      label: "Stability score",
      current: input.stabilityScore,
      target: targets.stabilityScore,
      format: (n) => `${n.toFixed(0)}/100`,
    },
    {
      id: "security",
      label: "Security score",
      current: input.securityScore,
      target: targets.securityScore,
      format: (n) => `${n.toFixed(0)}/100`,
    },
    {
      id: "trainer_pipeline",
      label: "Trainer pipeline completion",
      current: input.trainerPipelineCompletionRate,
      target: targets.trainerPipelineCompletionRate,
      format: (n) => `${(n * 100).toFixed(0)}%`,
    },
    {
      id: "subscription",
      label: "Client subscription conversion",
      current: input.subscriptionConversionRate,
      target: targets.subscriptionConversionRate,
      format: (n) => `${(n * 100).toFixed(0)}%`,
    },
    {
      id: "market",
      label: "Market balance",
      current: input.marketCompetitiveness,
      target: targets.marketCompetitiveness,
      format: (n) => `${(n * 100).toFixed(0)}%`,
    },
    {
      id: "active_ratio",
      label: "Active member ratio",
      current: activeRatio,
      target: targets.activeUserRatio,
      format: (n) => `${(n * 100).toFixed(0)}%`,
    },
  ];

  const optimizedFactors = rawChecks
    .filter((c) => c.current + 0.001 < c.target)
    .map((c) => ({
      id: c.id,
      label: c.label,
      currentRaw: c.current,
      targetRaw: c.target,
      gapLabel: `${c.format(c.current)} → ${c.format(c.target)}`,
    }));

  const recommendations: GrowthRecommendation[] = [];
  for (const factor of optimizedFactors) {
    const rec = recommendationForFactor(factor.id, factor.gapLabel);
    if (rec) recommendations.push(rec);
  }
  if (recommendations.length === 0) {
    recommendations.push({
      id: "maintain",
      label: "Maintain current trajectory",
      action:
        "Core levers look aligned for this stage. Focus on consistent traffic, onboarding completion, and trial conversion rather than large pivots.",
      impact: "low",
    });
  }

  const scenarios: PlatformPotentialScenario[] = [
    {
      id: "conservative",
      label: "Conservative (stagnation)",
      score: conservativeScore,
      assumptions: [
        "Active users and return visits flatten without new retention touches",
        "Revenue and conversion hold near current levels with mild friction drag",
        "Stability and security scores dip slightly from unresolved operational alerts",
      ],
    },
    {
      id: "optimistic",
      label: "Optimistic (levers optimized)",
      score: optimisticScore,
      assumptions: [
        "Stage targets met for retention, pipeline completion, and subscription conversion",
        "30d revenue trend projected forward with 15–25% growth headroom",
        "90-day maturity ramp and realistic beta ceilings on engagement",
      ],
    },
  ];

  return {
    scoreLow,
    scoreHigh,
    currentScore: success.score,
    scenarios,
    optimizedFactors,
    recommendations: recommendations.slice(0, 5),
    assumptions: scenarios.flatMap((s) => s.assumptions),
    meta: success.meta,
  };
}
