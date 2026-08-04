import { isBetaLaunchGatesEnabled } from "@/lib/beta-launch-config";
import type { FpAccountTier } from "@/lib/fp-account-tier-types";
import { fpTierRequiresMonthlyFee } from "@/lib/fp-account-tier-types";
import { FP_TIER_SIGNUP_CARDS, type FpTierCard } from "@/lib/fp-tier-signup-cards";
import { TRAINER_SIGNUP_PREMIUM_PROMO_DAYS } from "@/lib/trainer-signup-promo-copy";

export const FP_BETA_PREMIUM_PRO_STICKER =
  "60 DAYS OF PREMIUM PRO FREE FOR BETA USERS";

export const FP_BETA_DEFAULT_TIER: FpAccountTier = "match_fit_premium_pro";

/**
 * During beta the first N Fitness Pro sign-ups who ask for Match Fit Pro are given Match Fit
 * Premium Pro instead (JB, 2026-08-04). The tier picker already hides the Match Fit Pro card
 * during beta, but the upgrade is applied server-side as well so a stale page, a direct API
 * call, or beta ending mid-signup cannot land someone on the lesser tier.
 *
 * Counts Fitness Pro sign-ups overall, not just those who asked for Match Fit Pro.
 */
export const FP_BETA_PREMIUM_PRO_UPGRADE_MAX_DEFAULT = 30;

export function fpBetaPremiumProUpgradeMax(): number {
  const raw = process.env.MATCH_FIT_BETA_PREMIUM_PRO_UPGRADE_MAX?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FP_BETA_PREMIUM_PRO_UPGRADE_MAX_DEFAULT;
}

/**
 * Resolves the tier to actually store. Pure so the rule can be tested without a database —
 * the caller supplies how many Fitness Pros already exist.
 */
export function resolveFpSignupTier(
  requested: FpAccountTier,
  existingTrainerCount: number,
  betaActive = fpBetaSignupActive(),
): FpAccountTier {
  if (!betaActive) return requested;
  if (requested !== "match_fit_pro") return requested;
  if (existingTrainerCount >= fpBetaPremiumProUpgradeMax()) return requested;
  return "match_fit_premium_pro";
}

export type FpTierSignupOutcome = {
  /** The tier to store — may differ from what was asked for during the founding window. */
  tier: FpAccountTier;
  /** True when the Fitness Pro must complete Stripe checkout before the tier is granted. */
  requiresCheckoutNow: boolean;
  /** True when this sign-up fell inside the founding cohort that pays nothing up front. */
  foundingCohort: boolean;
};

/**
 * Decides what happens when a Fitness Pro picks an account type.
 *
 * The founding cohort — the first N sign-ups during beta — goes straight to the dashboard on
 * every tier, with no card and no Stripe redirect (JB, 2026-08-04). Their paid tier is granted
 * up front and payment is only asked for when the 60-day trial ends. After that cohort fills,
 * the tiers that carry a monthly fee take payment at selection time, while Match Fit Pro still
 * goes straight to the dashboard.
 *
 * Pure: the caller supplies the counts, so the rule is testable without a database.
 */
export function resolveFpTierSignupOutcome(args: {
  requested: FpAccountTier;
  existingTrainerCount: number;
  foundingCohortMax: number;
  /** Tiers only take payment when a price is actually set up for them. */
  tierHasConfiguredPrice: (tier: FpAccountTier) => boolean;
  betaActive?: boolean;
}): FpTierSignupOutcome {
  const betaActive = args.betaActive ?? fpBetaSignupActive();
  const tier = resolveFpSignupTier(args.requested, args.existingTrainerCount, betaActive);
  const foundingCohort = betaActive && args.existingTrainerCount < args.foundingCohortMax;

  if (foundingCohort) {
    return { tier, requiresCheckoutNow: false, foundingCohort: true };
  }

  return {
    tier,
    requiresCheckoutNow: fpTierRequiresMonthlyFee(tier) && args.tierHasConfiguredPrice(tier),
    foundingCohort: false,
  };
}

export function fpBetaSignupActive(): boolean {
  return isBetaLaunchGatesEnabled();
}

export function fpTierSelectableDuringBeta(tier: FpAccountTier): boolean {
  if (!fpBetaSignupActive()) return true;
  if (tier === "match_fit_premium_pro") return true;
  if (tier === "independent_fitness_pro" || tier === "elite_fitness_pro") return true;
  return false;
}

export function fpTierRequiresPaidSubscriptionDuringBeta(tier: FpAccountTier): boolean {
  if (!fpBetaSignupActive()) return fpTierRequiresMonthlyFee(tier);
  return tier === "independent_fitness_pro" || tier === "elite_fitness_pro";
}

export function fpBetaPremiumPromoEndsAt(from = new Date()): Date {
  const ends = new Date(from);
  ends.setUTCDate(ends.getUTCDate() + TRAINER_SIGNUP_PREMIUM_PROMO_DAYS);
  return ends;
}

/** Cards shown on signup tier step (beta hides complimentary Match Fit Pro). */
export function fpTierSignupCardsForDisplay(): readonly FpTierCard[] {
  if (!fpBetaSignupActive()) return FP_TIER_SIGNUP_CARDS;
  return FP_TIER_SIGNUP_CARDS.filter((card) => fpTierSelectableDuringBeta(card.tier));
}
