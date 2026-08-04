import type { FpAccountTier } from "@/lib/fp-account-tier-types";
import { fpTierRequiresMonthlyFee } from "@/lib/fp-account-tier-types";

/**
 * What to ask a Fitness Pro as their 60-day trial runs out.
 *
 * The founding cohort gets their chosen account type up front without paying (JB, 2026-08-04),
 * so the payment conversation happens here instead of at sign-up. Premium Pro is the one tier
 * with a free fallback: they can decline and keep a working Match Fit Pro account rather than
 * being pushed into a subscription. Independent and Elite have no free equivalent, so for those
 * the honest prompt is that payment is needed to keep the tier.
 *
 * Pure — no database, no clock of its own — so the boundaries are testable.
 */

export type TrainerTrialPrompt =
  /** Nothing to ask. */
  | { kind: "none" }
  /** Premium Pro: continue paying, or decline and drop to Match Fit Pro. */
  | { kind: "premium_choice"; daysLeft: number; expired: boolean }
  /** Independent / Elite: the tier needs a subscription to continue. */
  | { kind: "payment_required"; tier: FpAccountTier; daysLeft: number; expired: boolean };

export type TrainerTrialDecisionInput = {
  accountTier: string | null | undefined;
  platformTrialEndsAt: Date | string | null | undefined;
  stripeSubscriptionActive: boolean;
  platformBillingExempt?: boolean | null;
};

/** How early to start asking, so nobody is surprised on the last day. */
export const TRAINER_TRIAL_PROMPT_LEAD_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveTrainerTrialPrompt(
  input: TrainerTrialDecisionInput,
  nowMs: number = Date.now(),
): TrainerTrialPrompt {
  if (input.platformBillingExempt) return { kind: "none" };
  if (input.stripeSubscriptionActive) return { kind: "none" };

  const tier = input.accountTier as FpAccountTier | null | undefined;
  if (!tier) return { kind: "none" };

  const endsAtRaw = input.platformTrialEndsAt;
  if (!endsAtRaw) return { kind: "none" };
  const endsAt = endsAtRaw instanceof Date ? endsAtRaw : new Date(endsAtRaw);
  const endsAtMs = endsAt.getTime();
  if (!Number.isFinite(endsAtMs)) return { kind: "none" };

  const msLeft = endsAtMs - nowMs;
  const expired = msLeft <= 0;
  // Round up so "18 hours left" reads as 1 day, never 0.
  const daysLeft = expired ? 0 : Math.ceil(msLeft / DAY_MS);

  if (!expired && daysLeft > TRAINER_TRIAL_PROMPT_LEAD_DAYS) {
    return { kind: "none" };
  }

  if (tier === "match_fit_premium_pro") {
    return { kind: "premium_choice", daysLeft, expired };
  }
  if (fpTierRequiresMonthlyFee(tier)) {
    return { kind: "payment_required", tier, daysLeft, expired };
  }
  return { kind: "none" };
}
