import type { FpAccountTier } from "@/lib/fp-account-tier-types";
import {
  FP_NUDGE_PACK_SIZE,
  NUDGE_PACK_PURCHASE_NOTICE,
  trainerDailyFreeNudgeAllowance,
} from "@/lib/fp-tier-chat-policy";
import { trainerIndependentProSubscriptionLabel } from "@/lib/trainer-signup-promo-copy";

/**
 * Legacy free-tier cap for trainers without an FP account tier assigned.
 * Premium Page (`premiumStudioEnabledAt`) still bypasses this legacy cap.
 */
export const LEGACY_FREE_TRAINER_NUDGES_PER_DAY = 3;

/** Alias for callers that still import the pre-FP export name. */
export const FREE_TRAINER_NUDGES_PER_DAY = LEGACY_FREE_TRAINER_NUDGES_PER_DAY;

export { FP_NUDGE_PACK_SIZE, NUDGE_PACK_PURCHASE_NOTICE };

/** Plain string for API errors / toasts (no markup). */
export const PREMIUM_NUDGES_PRODUCT_NOTICE = `Need more than 3 nudges per day? Match Fit Independent Pro (${trainerIndependentProSubscriptionLabel()}) unlocks higher limits after your free trial.`;

export function utcDayRange(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export type NudgeQuotaEvaluation = {
  allowed: boolean;
  dailyLimit: number | null;
  nudgesUsedToday: number;
  nudgeCreditsBalance: number;
  usesPurchasedCredit: boolean;
  reason?: "daily_cap" | "not_allowed";
};

export function evaluateTrainerNudgeQuota(input: {
  accountTier: string | null | undefined;
  nudgesUsedToday: number;
  nudgeCreditsBalance: number;
  legacyPremiumStudio: boolean;
}): NudgeQuotaEvaluation {
  const dailyLimit = trainerDailyFreeNudgeAllowance(input.accountTier);
  const tier = input.accountTier as FpAccountTier | null | undefined;

  if (dailyLimit === 0) {
    return {
      allowed: false,
      dailyLimit,
      nudgesUsedToday: input.nudgesUsedToday,
      nudgeCreditsBalance: input.nudgeCreditsBalance,
      usesPurchasedCredit: false,
      reason: "not_allowed",
    };
  }

  if (dailyLimit == null || input.legacyPremiumStudio) {
    return {
      allowed: true,
      dailyLimit,
      nudgesUsedToday: input.nudgesUsedToday,
      nudgeCreditsBalance: input.nudgeCreditsBalance,
      usesPurchasedCredit: false,
    };
  }

  if (input.nudgesUsedToday < dailyLimit) {
    return {
      allowed: true,
      dailyLimit,
      nudgesUsedToday: input.nudgesUsedToday,
      nudgeCreditsBalance: input.nudgeCreditsBalance,
      usesPurchasedCredit: false,
    };
  }

  if (tier === "independent_fitness_pro" && input.nudgeCreditsBalance > 0) {
    return {
      allowed: true,
      dailyLimit,
      nudgesUsedToday: input.nudgesUsedToday,
      nudgeCreditsBalance: input.nudgeCreditsBalance,
      usesPurchasedCredit: true,
    };
  }

  return {
    allowed: false,
    dailyLimit,
    nudgesUsedToday: input.nudgesUsedToday,
    nudgeCreditsBalance: input.nudgeCreditsBalance,
    usesPurchasedCredit: false,
    reason: "daily_cap",
  };
}
