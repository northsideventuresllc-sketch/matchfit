/**
 * @deprecated Use `computePlatformPotentialRating` from `@/lib/platform-potential-rating`.
 * Kept for backward-compatible imports during the admin portal rating merge.
 */

import {
  computePlatformPotentialRating,
  type PlatformPotentialRatingBreakdown,
  type PlatformPotentialRatingInput,
} from "@/lib/platform-potential-rating";
import type { PlatformSuccessRatingBreakdown } from "@/lib/platform-success-rating";

export type PlatformPotentialSuccessInput = PlatformPotentialRatingInput;

export type PlatformPotentialSuccessBreakdown = {
  score: number;
  currentScore: number;
  uplift: number;
  successRating: PlatformSuccessRatingBreakdown;
  assumptions: string[];
};

/** @deprecated Use `computePlatformPotentialRating` — returns the optimistic ceiling as `score`. */
export function computePotentialSuccessScore(
  input: PlatformPotentialSuccessInput,
): PlatformPotentialSuccessBreakdown {
  const rating = computePlatformPotentialRating(input);
  const optimistic = rating.scenarios.find((s) => s.id === "optimistic");
  const score = rating.scoreHigh;
  const uplift = Math.round((score - rating.currentScore) * 10) / 10;

  return {
    score,
    currentScore: rating.currentScore,
    uplift,
    successRating: {
      score,
      factors: [],
      meta: rating.meta,
    },
    assumptions: optimistic?.assumptions ?? rating.assumptions,
  };
}

export type { PlatformPotentialRatingBreakdown };
