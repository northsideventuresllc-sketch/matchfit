/** Suspension after this many consecutive missed SESSION STARTED punch-ins (see `trainer-punch-miss-cron.ts`). */
export const TOS_PUNCH_MISS_SUSPEND_STREAK = 5;

/** Rolling window (days) for counting payout disputes toward suspension. */
export const TOS_PAYOUT_DISPUTE_ROLLING_DAYS = 30;

/** Suspension when this many disputes open in the rolling window (see `session-check-in-actions.ts`). */
export const TOS_PAYOUT_DISPUTE_SUSPEND_THRESHOLD = 3;
