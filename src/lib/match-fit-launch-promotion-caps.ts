/**
 * Client-safe founding promo caps (env only — no Prisma / Node DB imports).
 * Import this module from `"use client"` pages; server billing code may use
 * `@/lib/match-fit-launch-promotions` which re-exports these helpers.
 */

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const n = parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, n);
}

export type TrainerRegistrationPricingMode =
  | "FOUNDING_BG_COVERED"
  | "FOUNDING_BG_SURCHARGE_20PCT"
  /** Beta band above the founding cap: discounted platform fee, own background check. */
  | "BETA_DISCOUNTED"
  | "STANDARD_100_MINUS_BG";

/**
 * Percentage off the standard platform fee for the discounted beta band (JB, 2026-08-04).
 * Env-overridable so the rate can be changed without a deploy.
 */
export function getTrainerBetaDiscountPercent(): number {
  const n = parseInt(String(process.env.MATCH_FIT_TRAINER_BETA_DISCOUNT_PERCENT ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 99) return 50;
  return n;
}

/**
 * The founding cohort size — the first N trainer sign-ups during beta. This cohort skips
 * paid-tier checkout and gets 60 days of Match Fit Premium Pro free (JB, 2026-08-04). Default 30.
 */
export function getTrainerBetaDiscountedMax(): number {
  return parsePositiveInt(process.env.MATCH_FIT_TRAINER_BETA_DISCOUNTED_MAX, 30, 1_000_000);
}

/**
 * First N trainers receive fully platform-covered background screening (Checkr fee paid by
 * Match Fit, no escrow hold on the Fitness Pro's card).
 *
 * Corrected 2026-09-14 (JB direct, "FOUNDING FITNESS PRO BETA PROMOTION" note, confirmed on a
 * real conflict with the live code): background checks are FULLY covered for the WHOLE founding
 * cohort — the first 30, not just a smaller first-10 sub-tier. This previously defaulted to a
 * hardcoded 10, which left sign-ups 11-30 paying for their own Checkr screening. It now tracks
 * the founding cohort size (`getTrainerBetaDiscountedMax`, default 30) unless explicitly
 * overridden below, so the two caps can never drift apart again.
 */
export function getTrainerFoundingBgCoveredMax(): number {
  const explicit = process.env.MATCH_FIT_TRAINER_FOUNDING_BG_COVERED_MAX?.trim();
  if (explicit) return parsePositiveInt(explicit, getTrainerBetaDiscountedMax(), 1_000_000);
  const legacyPercentMax = process.env.MATCH_FIT_TRAINER_FOUNDING_BG_PERCENT_MAX?.trim();
  if (legacyPercentMax) return parsePositiveInt(legacyPercentMax, getTrainerBetaDiscountedMax(), 1_000_000);
  return getTrainerBetaDiscountedMax();
}

/** @deprecated Use getTrainerFoundingBgCoveredMax */
export function getTrainerFoundingBgPercentMax(): number {
  return getTrainerFoundingBgCoveredMax();
}

/** @deprecated Use getTrainerFoundingBgPercentMax — kept for env migration. */
export function getTrainerFoundingRegistrationWaiverMax(): number {
  const legacy = process.env.MATCH_FIT_TRAINER_FOUNDING_REGISTRATION_WAIVER_MAX?.trim();
  if (legacy) return parsePositiveInt(legacy, getTrainerFoundingBgPercentMax(), 1_000_000);
  return getTrainerFoundingBgPercentMax();
}

/** First N clients eligible for founding promo slot counting. Default 150. */
export function getClientFoundingTrialMaxClients(): number {
  return parsePositiveInt(process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_MAX_CLIENTS, 150, 1_000_000);
}

/** Founding trial length (days). Default 60. */
export function getClientFoundingTrialDays(): number {
  return parsePositiveInt(process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_DAYS, 60, 730);
}

/** Legacy Stripe checkout (pending registration holds): optional short trial with card on file. Default 3. */
export function getClientPostCapTrialDays(): number {
  return parsePositiveInt(process.env.MATCH_FIT_CLIENT_POST_CAP_TRIAL_DAYS, 3, 90);
}

export type ClientSubscriptionBillingChoice = "founding_trial_14d" | "trial_3d" | "pay_now";

/** @deprecated Prefer countLaunchClients + getClientFoundingTrialMaxClients */
export function isNextClientEligibleForFoundingTrial(clientCount: number): boolean {
  return clientCount < getClientFoundingTrialMaxClients();
}

export function isTrainerFoundingBgPercentTier(trainerCountBeforeInsert: number): boolean {
  return trainerCountBeforeInsert < getTrainerFoundingBgCoveredMax();
}

/** Whether the next trainer signup receives platform-covered background screening. */
export function isTrainerFoundingBgCoveredTier(trainerCountBeforeInsert: number): boolean {
  return isTrainerFoundingBgPercentTier(trainerCountBeforeInsert);
}

/** @deprecated Use isTrainerFoundingBgPercentTier */
export function isNextTrainerEligibleForRegistrationWaiver(trainerCountBeforeInsert: number): boolean {
  return isTrainerFoundingBgPercentTier(trainerCountBeforeInsert);
}
