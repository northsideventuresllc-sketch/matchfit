import { TRAINER_PREMIUM_SUBSCRIPTION_USD } from "@/lib/platform-revenue-accounting";

/** Card-free Independent Pro platform access after trainer registration. */
export const TRAINER_PLATFORM_TRIAL_DAYS = 60;

/** Window after trial ends to add a card and subscribe before deactivation. */
export const TRAINER_PAYMENT_GRACE_DAYS = 14;

/** Monthly Independent Pro / Premium Page subscription (USD). */
export const TRAINER_PLATFORM_SUBSCRIPTION_USD = TRAINER_PREMIUM_SUBSCRIPTION_USD;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addTrainerPlatformTrialDays(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRAINER_PLATFORM_TRIAL_DAYS * MS_PER_DAY);
}

export function addTrainerPaymentGraceDays(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRAINER_PAYMENT_GRACE_DAYS * MS_PER_DAY);
}

export function trainerPlatformSubscriptionLabel(): string {
  return `$${TRAINER_PLATFORM_SUBSCRIPTION_USD.toFixed(2)} per month`;
}
