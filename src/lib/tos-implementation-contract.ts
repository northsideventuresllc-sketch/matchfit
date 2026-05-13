/**
 * Single source of truth for Terms-adjacent product constants.
 * Import here from implementation modules — do not duplicate numbers.
 */

import {
  CHECK_IN_LEAD_HOURS,
  GATE_A_POST_SESSION_SILENCE_HOURS,
  PAYOUT_BUFFER_AFTER_BOTH_GATES_HOURS,
} from "@/lib/session-check-in-timing";
import { PLATFORM_ADMIN_FEE_RATE } from "@/lib/platform-fees";
import { OFF_PLATFORM_LIQUIDATED_DAMAGES_USD } from "@/lib/tos-off-platform-deterrent";
import {
  TOS_PAYOUT_DISPUTE_ROLLING_DAYS,
  TOS_PAYOUT_DISPUTE_SUSPEND_THRESHOLD,
  TOS_PUNCH_MISS_SUSPEND_STREAK,
} from "@/lib/tos-governance-thresholds";
import { MATCH_BATCH_WINDOW_MS, STANDARD_MATCH_BATCH_SIZE } from "@/lib/trainer-discover-match-batch";
import { INITIAL_OUTBOUND_MESSAGE_CAP } from "@/lib/trainer-client-chat-rules";

/** Shown at client subscribe and in Terms §3 examples. */
export const TOS_CLIENT_PLATFORM_SUBSCRIPTION_USD = 10;
/** Intro promo example in Terms §3 when we run such programs. */
export const TOS_CLIENT_PLATFORM_PROMO_USD = 4;

export const MATCH_BATCH_WINDOW_HOURS = MATCH_BATCH_WINDOW_MS / (60 * 60 * 1000);

export const PLATFORM_ADMIN_FEE_PERCENT = Math.round(PLATFORM_ADMIN_FEE_RATE * 100);

export {
  CHECK_IN_LEAD_HOURS,
  GATE_A_POST_SESSION_SILENCE_HOURS,
  INITIAL_OUTBOUND_MESSAGE_CAP,
  MATCH_BATCH_WINDOW_MS,
  OFF_PLATFORM_LIQUIDATED_DAMAGES_USD,
  PAYOUT_BUFFER_AFTER_BOTH_GATES_HOURS,
  PLATFORM_ADMIN_FEE_RATE,
  STANDARD_MATCH_BATCH_SIZE,
  TOS_PAYOUT_DISPUTE_ROLLING_DAYS,
  TOS_PAYOUT_DISPUTE_SUSPEND_THRESHOLD,
  TOS_PUNCH_MISS_SUSPEND_STREAK,
};
