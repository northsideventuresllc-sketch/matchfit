/**
 * Platform success rating (0–10) for the admin dashboard.
 *
 * Launch context (hard-coded product milestones):
 * - Public launch: 2026-05-21
 * - Paid marketing start: 2026-05-25
 * - Marketing budget: $70 USD
 *
 * Weighted blend of normalized sub-scores (each 0–1), then scaled to 0–10.
 */

export const PLATFORM_LAUNCH_DATE = new Date("2026-05-21T00:00:00.000Z");
export const PLATFORM_MARKETING_START_DATE = new Date("2026-05-25T00:00:00.000Z");
export const PLATFORM_MARKETING_BUDGET_USD = 70;
/** Performance metrics (revenue, conversion, retention) do not penalize the score until this many days post-launch. */
export const PLATFORM_PERFORMANCE_GRACE_DAYS = 90;
/** Neutral normalized contribution for performance factors during the build-phase grace window. */
const GRACE_NEUTRAL_NORMALIZED = 0.68;

const PERFORMANCE_FACTOR_IDS = new Set([
  "active_ratio",
  "retention",
  "revenue_per_day",
  "margin",
  "trainer_pipeline",
  "subscription",
  "market",
]);

export type PlatformSuccessRatingInput = {
  now?: Date;
  daysSinceLaunch: number;
  totalUsers: number;
  activeUsers: number;
  /** Distinct returning visitorIds / distinct visitorIds in last 30d (0–1). */
  returningVisitorRatio: number;
  revenuePerDayCents: number;
  grossProfitMargin: number;
  stabilityScore: number;
  securityScore: number;
  /** Trainers with dashboardActivatedAt / trainers who completed signup (0–1). */
  trainerPipelineCompletionRate: number;
  /** Active subscribers / total clients (0–1). */
  subscriptionConversionRate: number;
  /** Synthetic market-health proxy from trainer/client ratio and featured participation (0–1). */
  marketCompetitiveness: number;
};

export type PlatformSuccessRatingBreakdown = {
  score: number;
  factors: {
    id: string;
    label: string;
    weight: number;
    raw: number;
    normalized: number;
    contribution: number;
  }[];
  meta: {
    launchDate: string;
    marketingStartDate: string;
    marketingBudgetUsd: number;
    daysSinceLaunch: number;
    performanceMetricsActive: boolean;
    performanceGraceDaysRemaining: number;
  };
};

const FACTORS: { id: string; label: string; weight: number; target: number; invert?: boolean }[] = [
  { id: "maturity", label: "Days since launch (ramp)", weight: 0.08, target: 90 },
  { id: "active_ratio", label: "Active users / total users", weight: 0.12, target: 1 },
  { id: "retention", label: "Returning visitor ratio (30d)", weight: 0.1, target: 1 },
  { id: "revenue_per_day", label: "Revenue per day ($)", weight: 0.12, target: 5000 },
  { id: "margin", label: "Gross profit margin", weight: 0.1, target: 1 },
  { id: "stability", label: "Platform stability score", weight: 0.12, target: 100 },
  { id: "security", label: "Security score", weight: 0.1, target: 100 },
  { id: "trainer_pipeline", label: "Trainer pipeline completion", weight: 0.1, target: 1 },
  { id: "subscription", label: "Client subscription conversion", weight: 0.08, target: 1 },
  { id: "market", label: "Market competitiveness proxy", weight: 0.08, target: 1 },
];

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function normalize(raw: number, target: number, invert?: boolean): number {
  if (target <= 0) return 0;
  const ratio = raw / target;
  const n = invert ? 1 - clamp01(ratio) : clamp01(ratio);
  return n;
}

export function daysSinceLaunch(now: Date = new Date()): number {
  const ms = now.getTime() - PLATFORM_LAUNCH_DATE.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export function computeMarketCompetitivenessProxy(args: {
  clientsTotal: number;
  trainersTotal: number;
  trainersLive: number;
  featuredToday: number;
}): number {
  const clientTrainerRatio =
    args.trainersTotal > 0 ? args.clientsTotal / args.trainersTotal : args.clientsTotal > 0 ? 0.2 : 0.5;
  const ratioScore = clamp01(clientTrainerRatio / 8);
  const liveShare = args.trainersTotal > 0 ? args.trainersLive / args.trainersTotal : 0;
  const featuredShare = args.trainersLive > 0 ? args.featuredToday / args.trainersLive : 0;
  return clamp01(ratioScore * 0.45 + liveShare * 0.35 + clamp01(featuredShare) * 0.2);
}

function performanceGraceBlend(daysSinceLaunch: number): number {
  if (daysSinceLaunch >= PLATFORM_PERFORMANCE_GRACE_DAYS) return 1;
  if (daysSinceLaunch <= 0) return 0;
  return daysSinceLaunch / PLATFORM_PERFORMANCE_GRACE_DAYS;
}

export function computePlatformSuccessRating(input: PlatformSuccessRatingInput): PlatformSuccessRatingBreakdown {
  const graceBlend = performanceGraceBlend(input.daysSinceLaunch);
  const performanceMetricsActive = graceBlend >= 1;

  const rawById: Record<string, number> = {
    maturity: input.daysSinceLaunch,
    active_ratio: input.totalUsers > 0 ? input.activeUsers / input.totalUsers : 0,
    retention: input.returningVisitorRatio,
    revenue_per_day: input.revenuePerDayCents / 100,
    margin: input.grossProfitMargin,
    stability: input.stabilityScore / 100,
    security: input.securityScore / 100,
    trainer_pipeline: input.trainerPipelineCompletionRate,
    subscription: input.subscriptionConversionRate,
    market: input.marketCompetitiveness,
  };

  const factors = FACTORS.map((f) => {
    const raw = rawById[f.id] ?? 0;
    let normalized = normalize(raw, f.target, f.invert);
    if (PERFORMANCE_FACTOR_IDS.has(f.id)) {
      normalized = graceBlend * normalized + (1 - graceBlend) * GRACE_NEUTRAL_NORMALIZED;
    }
    const contribution = normalized * f.weight * 10;
    return {
      id: f.id,
      label: f.label,
      weight: f.weight,
      raw,
      normalized,
      contribution,
    };
  });

  const score = Math.round(clamp01(factors.reduce((s, f) => s + f.contribution, 0) / 10) * 100) / 10;
  const graceDaysRemaining = Math.max(0, PLATFORM_PERFORMANCE_GRACE_DAYS - input.daysSinceLaunch);

  return {
    score,
    factors,
    meta: {
      launchDate: PLATFORM_LAUNCH_DATE.toISOString().slice(0, 10),
      marketingStartDate: PLATFORM_MARKETING_START_DATE.toISOString().slice(0, 10),
      marketingBudgetUsd: PLATFORM_MARKETING_BUDGET_USD,
      daysSinceLaunch: input.daysSinceLaunch,
      performanceMetricsActive,
      performanceGraceDaysRemaining: graceDaysRemaining,
    },
  };
}
