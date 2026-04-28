/**
 * Free-tier cap for trainer-initiated discovery nudges.
 * Premium unlimited nudges ($19.99/mo) will be enforced separately when billing ships.
 */
export const FREE_TRAINER_NUDGES_PER_DAY = 3;

export const PREMIUM_NUDGES_PRODUCT_NOTICE =
  "Need more than 3 nudges per day? Match Fit Premium ($19.99/month) will unlock higher limits — billing is handled by a separate integration.";

export function utcDayRange(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
