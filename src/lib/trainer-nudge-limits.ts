/**
 * Free-tier cap for trainer-initiated discovery nudges (non-premium trainers).
 * Premium trainers skip this cap (`premiumStudioEnabledAt` on profile).
 */
export const FREE_TRAINER_NUDGES_PER_DAY = 3;

/** Plain string for API errors / toasts (no markup). */
export const PREMIUM_NUDGES_PRODUCT_NOTICE =
  "Need more than 3 nudges per day? Match Fit Premium ($19.99/month) will unlock higher limits — billing is handled by a separate integration.";

export function utcDayRange(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
