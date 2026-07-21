import "server-only";

import {
  createNiBrainClient,
  isNiBrainConfiguredAsync,
} from "@/lib/ni-brain-client";

/**
 * Match Fit marketing skeleton (Sector 1A — own brand).
 *
 * Reads the `match-fit` row from NI-Brain `ni_marketing_skeletons` so content
 * generation + outreach drafts always use the current winning angles, and
 * records revenue-grade signals (trainer signups) back into the adapt loop.
 *
 * The skeleton is adjusted weekly by the NI Portal `marketing-skeleton-adapt`
 * cron and refreshed 2x/week by `marketing-trend-research`. Match Fit stays a
 * separate brand — this module only shares the learning infrastructure.
 */

export interface SkeletonAngle {
  id: string;
  text: string;
  channel?: string;
  score: number;
  status: string;
}

export interface MatchFitSkeleton {
  version: number;
  hooks: SkeletonAngle[];
  valueProps: SkeletonAngle[];
  winningAngleIds: string[];
  trendNotes: { date: string; note: string }[];
  goals: { metric?: string; target?: number; deadline?: string };
}

const PRODUCT_SLUG = "match-fit";

export async function fetchMatchFitSkeleton(): Promise<MatchFitSkeleton | null> {
  if (!(await isNiBrainConfiguredAsync())) return null;
  const client = createNiBrainClient();
  const { data, error } = await client
    .from("ni_marketing_skeletons")
    .select("version, hooks, value_props, winning_angles, trend_notes, goals")
    .eq("product_slug", PRODUCT_SLUG)
    .maybeSingle();
  if (error || !data) return null;

  return {
    version: data.version ?? 1,
    hooks: Array.isArray(data.hooks) ? data.hooks : [],
    valueProps: Array.isArray(data.value_props) ? data.value_props : [],
    winningAngleIds: Array.isArray(data.winning_angles) ? data.winning_angles : [],
    trendNotes: Array.isArray(data.trend_notes) ? data.trend_notes.slice(-6) : [],
    goals: data.goals ?? {},
  };
}

/** Winning-first angle lines for content prompt injection. */
export async function fetchWinningAngleLines(limit = 5): Promise<string[]> {
  const skeleton = await fetchMatchFitSkeleton();
  if (!skeleton) return [];
  const ranked = [...skeleton.hooks, ...skeleton.valueProps]
    .filter((a) => a.status !== "losing" && a.status !== "retired")
    .sort((a, b) => {
      const aWin = skeleton.winningAngleIds.includes(a.id) ? 1 : 0;
      const bWin = skeleton.winningAngleIds.includes(b.id) ? 1 : 0;
      if (aWin !== bWin) return bWin - aWin;
      return b.score - a.score;
    })
    .slice(0, limit);
  return ranked.map((a) => a.text);
}

/** Record an attributable Match Fit marketing signal into the adapt loop. */
export async function recordMatchFitMarketingSignal(args: {
  signalType: "revenue" | "signup" | "engagement" | "ad" | "content";
  angleId?: string;
  value?: number;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!(await isNiBrainConfiguredAsync())) return;
    const client = createNiBrainClient();
    await client.from("ni_marketing_skeleton_signals").insert({
      product_slug: PRODUCT_SLUG,
      signal_type: args.signalType,
      angle_id: args.angleId ?? null,
      value: args.value ?? 1,
      detail: args.detail ?? {},
    });
  } catch (error) {
    console.error("[marketing/skeleton] signal failed:", error);
  }
}
