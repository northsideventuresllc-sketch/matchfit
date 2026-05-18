/**
 * Founding-launch promotions (client subscription trial, trainer registration waiver).
 * Limits are configurable via env for staging vs production.
 */

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const n = parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, n);
}

/** Max number of clients who receive a Stripe subscription trial at first checkout (default 10). */
export function getClientFoundingTrialMaxClients(): number {
  return parsePositiveInt(process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_MAX_CLIENTS, 10, 1_000_000);
}

/** Trial length in days for founding client checkouts (default 30, capped at 730). */
export function getClientFoundingTrialDays(): number {
  return parsePositiveInt(process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_DAYS, 30, 730);
}

/** Max trainers who receive registration fee waiver at signup (default 3). */
export function getTrainerFoundingRegistrationWaiverMax(): number {
  return parsePositiveInt(process.env.MATCH_FIT_TRAINER_FOUNDING_REGISTRATION_WAIVER_MAX, 3, 1_000_000);
}

/** True when the next completed client subscription checkout should include a Stripe trial. */
export function isNextClientEligibleForFoundingTrial(clientCount: number): boolean {
  return clientCount < getClientFoundingTrialMaxClients();
}

/** True when the next new trainer account should waive the platform registration fee. */
export function isNextTrainerEligibleForRegistrationWaiver(trainerCountBeforeInsert: number): boolean {
  return trainerCountBeforeInsert < getTrainerFoundingRegistrationWaiverMax();
}
