/**
 * Non-production usernames and staff emails excluded from every member metric
 * (admin active counts, homepage counters, beta caps, founding promos, funnel stats).
 *
 * Includes owner dev/QA portals from seed scripts — never counted as real members.
 */

/** Client usernames that must never appear in member totals. */
export const MATCH_FIT_EXCLUDE_NON_PRODUCTION_CLIENT_USERNAMES = [
  "jbfitness6299",
  "jonnybronny22",
  "jonnybronny",
  "jibbyjam22",
  "twofa_tester",
] as const;

/** Trainer usernames that must never appear in member totals. */
export const MATCH_FIT_EXCLUDE_NON_PRODUCTION_TRAINER_USERNAMES = [
  "coachjonny22",
  "jibbyjam22",
] as const;

/** Trainer/staff emails for QA portals — never counted as members. */
export const MATCH_FIT_EXCLUDE_NON_PRODUCTION_MEMBER_EMAILS = [
  "jonnybooth22@gmail.com",
  "jb@northsideventuresgroup.com",
  "jb@match-fit.net",
  "twofa_tester@example.test",
] as const;

/** Admin directory redaction — hides email for owner QA portals in member search. */
export const MATCH_FIT_ADMIN_REDACT_CLIENT_USERNAMES = [
  "jbfitness6299",
  "jonnybronny22",
  "jibbyjam22",
] as const;

export const MATCH_FIT_ADMIN_REDACT_TRAINER_USERNAMES = [
  "coachjonny22",
  "jibbyjam22",
] as const;
