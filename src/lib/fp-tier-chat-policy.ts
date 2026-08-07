import type { FpAccountTier } from "@/lib/fp-account-tier-types";
import { isFpAccountTier } from "@/lib/fp-account-tier-types";
import { getFpTierPermissions } from "@/lib/fp-tier-permissions";

export const INDEPENDENT_FP_DAILY_NUDGES = 10;
export const FP_NUDGE_PACK_SIZE = 10;
export const FP_NUDGE_PACK_PRICE_USD = 5;

export function resolveTrainerFpAccountTier(accountTier: string | null | undefined): FpAccountTier | null {
  if (!accountTier || !isFpAccountTier(accountTier)) return null;
  return accountTier;
}

export function trainerCanUseInAppChat(accountTier: string | null | undefined): boolean {
  const tier = resolveTrainerFpAccountTier(accountTier);
  if (!tier) return true;
  return getFpTierPermissions(tier)?.in_app_messaging ?? false;
}

export function trainerCanUseNudgeFeature(accountTier: string | null | undefined): boolean {
  const tier = resolveTrainerFpAccountTier(accountTier);
  if (!tier) return true;
  return getFpTierPermissions(tier)?.nudge_feature ?? false;
}

export function trainerNudgeOpensChat(accountTier: string | null | undefined): boolean {
  const tier = resolveTrainerFpAccountTier(accountTier);
  if (!tier) return true;
  return trainerCanUseInAppChat(tier);
}

export function trainerHasEliteChatPolicy(accountTier: string | null | undefined): boolean {
  return resolveTrainerFpAccountTier(accountTier) === "elite_fitness_pro";
}

/** Daily free nudges before purchased credits apply. `null` = no daily cap. */
export function trainerDailyFreeNudgeAllowance(accountTier: string | null | undefined): number | null {
  const tier = resolveTrainerFpAccountTier(accountTier);
  if (!tier) return 3;
  if (tier === "independent_fitness_pro") return INDEPENDENT_FP_DAILY_NUDGES;
  if (tier === "elite_fitness_pro") return null;
  if (tier === "match_fit_pro" || tier === "match_fit_premium_pro") return 0;
  return 0;
}

export const INDEPENDENT_FP_NO_CHAT_MESSAGE =
  "Independent Fitness Pro accounts use discovery nudges only. In-app chat is not available on this account type.";

export const NUDGE_FEATURE_UNAVAILABLE_MESSAGE =
  "Discovery nudges are not included on your account type.";

export const NUDGE_DAILY_CAP_MESSAGE = (used: number, limit: number) =>
  `You have used all ${limit} discovery nudges for today (${used}/${limit}).`;

export const NUDGE_PACK_PURCHASE_NOTICE = `Purchase ${FP_NUDGE_PACK_SIZE} more nudges for $${FP_NUDGE_PACK_PRICE_USD.toFixed(2)}.`;

export function eliteFitnessProChatNotice(): string {
  return "Elite Fitness Pro may share business email addresses in chat. Phone numbers and off-platform payment details are still not allowed.";
}

export function matchFitProChatNotice(): string {
  return "Keep payments and scheduling on Match Fit. Messages that look like off-platform payment requests or hidden contact info may be flagged for review.";
}

export function chatNoticeForTrainerTier(accountTier: string | null | undefined): string {
  if (trainerHasEliteChatPolicy(accountTier)) return eliteFitnessProChatNotice();
  return matchFitProChatNotice();
}
