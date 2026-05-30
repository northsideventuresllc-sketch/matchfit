/**
 * Launch pricing: client membership trials and trainer registration fee tiers.
 * Beta caps live in `beta-launch-config.ts` (separate from founding promo caps below).
 */

import { countLaunchClients, countLaunchTrainers } from "@/lib/launch-account-counts";

export type {
  ClientSubscriptionBillingChoice,
  TrainerRegistrationPricingMode,
} from "@/lib/match-fit-launch-promotion-caps";

export {
  getClientFoundingTrialDays,
  getClientFoundingTrialMaxClients,
  getClientPostCapTrialDays,
  getTrainerFoundingBgPercentMax,
  getTrainerFoundingRegistrationWaiverMax,
  isNextClientEligibleForFoundingTrial,
  isNextTrainerEligibleForRegistrationWaiver,
  isTrainerFoundingBgPercentTier,
} from "@/lib/match-fit-launch-promotion-caps";

import {
  getClientFoundingTrialDays,
  getClientFoundingTrialMaxClients,
  getClientPostCapTrialDays,
  type ClientSubscriptionBillingChoice,
} from "@/lib/match-fit-launch-promotion-caps";

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

export async function trainerCountBeforeNextRegistration(): Promise<number> {
  return countLaunchTrainers();
}
