/**
 * Launch pricing: client membership trials and trainer registration fee tiers.
 * Beta caps (10 trainers / 50 clients) live in `beta-launch-config.ts`.
 */

import { countLaunchClients, countLaunchTrainers } from "@/lib/launch-account-counts";

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  const n = parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, n);
}

export type TrainerRegistrationPricingMode = "FOUNDING_BG_SURCHARGE_20PCT" | "STANDARD_100_MINUS_BG";

/** First N trainers pay 20% of Checkr background fee (not $100 minus BG). Default 10. */
export function getTrainerFoundingBgPercentMax(): number {
  return parsePositiveInt(process.env.MATCH_FIT_TRAINER_FOUNDING_BG_PERCENT_MAX, 10, 1_000_000);
}

/** @deprecated Use getTrainerFoundingBgPercentMax — kept for env migration. */
export function getTrainerFoundingRegistrationWaiverMax(): number {
  const legacy = process.env.MATCH_FIT_TRAINER_FOUNDING_REGISTRATION_WAIVER_MAX?.trim();
  if (legacy) return parsePositiveInt(legacy, 10, 1_000_000);
  return getTrainerFoundingBgPercentMax();
}

/** First N clients: card required up front, 14-day trial before first invoice. Default 50. */
export function getClientFoundingTrialMaxClients(): number {
  return parsePositiveInt(process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_MAX_CLIENTS, 50, 1_000_000);
}

/** Founding trial length (days). Default 14. */
export function getClientFoundingTrialDays(): number {
  return parsePositiveInt(process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_DAYS, 14, 730);
}

/** After founding cap: optional short trial length (days). Default 3. */
export function getClientPostCapTrialDays(): number {
  return parsePositiveInt(process.env.MATCH_FIT_CLIENT_POST_CAP_TRIAL_DAYS, 3, 90);
}

export type ClientSubscriptionBillingChoice = "founding_trial_14d" | "trial_3d" | "pay_now";

export async function resolveClientSubscriptionBilling(args: {
  billingChoice?: ClientSubscriptionBillingChoice | null;
}): Promise<{
  foundingSlot: boolean;
  trialDays: number;
  choice: ClientSubscriptionBillingChoice;
}> {
  const activeClients = await countLaunchClients();
  const foundingSlot = activeClients < getClientFoundingTrialMaxClients();
  if (foundingSlot) {
    return { foundingSlot: true, trialDays: getClientFoundingTrialDays(), choice: "founding_trial_14d" };
  }
  const choice = args.billingChoice === "pay_now" ? "pay_now" : "trial_3d";
  const trialDays = choice === "trial_3d" ? getClientPostCapTrialDays() : 0;
  return { foundingSlot: false, trialDays, choice };
}

/** @deprecated Prefer countLaunchClients + getClientFoundingTrialMaxClients */
export function isNextClientEligibleForFoundingTrial(clientCount: number): boolean {
  return clientCount < getClientFoundingTrialMaxClients();
}

export function isTrainerFoundingBgPercentTier(trainerCountBeforeInsert: number): boolean {
  return trainerCountBeforeInsert < getTrainerFoundingBgPercentMax();
}

/** @deprecated Use isTrainerFoundingBgPercentTier */
export function isNextTrainerEligibleForRegistrationWaiver(trainerCountBeforeInsert: number): boolean {
  return isTrainerFoundingBgPercentTier(trainerCountBeforeInsert);
}

export async function trainerCountBeforeNextRegistration(): Promise<number> {
  return countLaunchTrainers();
}
