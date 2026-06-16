/** Card-free platform access after client sign-up. */
export const CLIENT_PLATFORM_TRIAL_DAYS = 60;

/** Window after trial ends to add a card and subscribe before deactivation. */
export const CLIENT_PAYMENT_GRACE_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addPlatformTrialDays(from: Date = new Date()): Date {
  return new Date(from.getTime() + CLIENT_PLATFORM_TRIAL_DAYS * MS_PER_DAY);
}

export function addPaymentGraceDays(from: Date = new Date()): Date {
  return new Date(from.getTime() + CLIENT_PAYMENT_GRACE_DAYS * MS_PER_DAY);
}
