import type { SignupProgressRole } from "@/lib/signup-progress-reporter";
import type { TransactionalEmailKind } from "@/lib/transactional-email-kinds";

/**
 * 3-email abandoned-signup follow-up sequence. Spacing chosen by Claude (JB can adjust):
 * 1 hour, 24 hours, 72 hours after the signup_form_progress row's last activity
 * (`updatedAt`) — all three offsets measured from that same last-activity point, not
 * chained off the previous email, so a slow cron tick never drifts the schedule.
 */
export const SIGNUP_FOLLOWUP_DELAYS_MS: readonly [number, number, number] = [
  60 * 60 * 1000, // 1 hour
  24 * 60 * 60 * 1000, // 24 hours
  72 * 60 * 60 * 1000, // 72 hours
];

export const SIGNUP_FOLLOWUP_KIND_BY_ROLE: Record<SignupProgressRole, readonly [TransactionalEmailKind, TransactionalEmailKind, TransactionalEmailKind]> = {
  trainer: ["TRAINER_SIGNUP_FOLLOWUP_1", "TRAINER_SIGNUP_FOLLOWUP_2", "TRAINER_SIGNUP_FOLLOWUP_3"],
  client: ["CLIENT_SIGNUP_FOLLOWUP_1", "CLIENT_SIGNUP_FOLLOWUP_2", "CLIENT_SIGNUP_FOLLOWUP_3"],
};

export const SIGNUP_FOLLOWUP_MAX_COUNT = 3;

export function signupResumePathForRole(role: SignupProgressRole): string {
  return role === "trainer" ? "/trainer/signup" : "/client/sign-up";
}

/**
 * Whether a signup_form_progress row (email present, not yet completed, followupEmailsSent
 * in [0,3)) is due for its next follow-up email right now, given `updatedAt` (last activity)
 * and `now`. Pure so it is trivially unit testable — the cron just filters/queries with the
 * equivalent SQL and calls this to double-check before sending.
 */
export function isDueForNextSignupFollowup(args: {
  followupEmailsSent: number;
  updatedAt: Date;
  now: Date;
}): boolean {
  if (args.followupEmailsSent < 0 || args.followupEmailsSent >= SIGNUP_FOLLOWUP_MAX_COUNT) return false;
  const delay = SIGNUP_FOLLOWUP_DELAYS_MS[args.followupEmailsSent];
  return args.now.getTime() - args.updatedAt.getTime() >= delay;
}

export function nextSignupFollowupKind(
  role: SignupProgressRole,
  followupEmailsSent: number,
): TransactionalEmailKind | null {
  if (followupEmailsSent < 0 || followupEmailsSent >= SIGNUP_FOLLOWUP_MAX_COUNT) return null;
  return SIGNUP_FOLLOWUP_KIND_BY_ROLE[role][followupEmailsSent];
}
