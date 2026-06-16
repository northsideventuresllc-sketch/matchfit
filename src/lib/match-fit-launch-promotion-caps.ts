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
  | "STANDARD_100_MINUS_BG";

/** First N trainers receive platform-covered background screening. Default 10. */
export function getTrainerFoundingBgCoveredMax(): number {
  const explicit = process.env.MATCH_FIT_TRAINER_FOUNDING_BG_COVERED_MAX?.trim();
  if (explicit) return parsePositiveInt(explicit, 10, 1_000_000);
  return parsePositiveInt(process.env.MATCH_FIT_TRAINER_FOUNDING_BG_PERCENT_MAX, 10, 1_000_000);
}

/** @deprecated Use getTrainerFoundingBgCoveredMax */
export function getTrainerFoundingBgPercentMax(): number {
  return getTrainerFoundingBgCoveredMax();
}

/** @deprecated Use getTrainerFoundingBgPercentMax — kept for env migration. */
export function getTrainerFoundingRegistrationWaiverMax(): number {
  const legacy = process.env.MATCH_FIT_TRAINER_FOUNDING_REGISTRATION_WAIVER_MAX?.trim();
  if (legacy) return parsePositiveInt(legacy, 10, 1_000_000);
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
