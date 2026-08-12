/**
 * Shown in trainer onboarding, compliance, and chat surfaces — aligns with Terms §12 / §15.
 *
 * Replaced 2026-08-07 (JB): the flat per-occurrence dollar fee is gone. Off-platform payment
 * circumvention and substantiated chat contact-info leaks (phone numbers, personal emails) now
 * carry a two-strike ban instead — first substantiated offense is a temporary suspension, second
 * is permanent. See `@/lib/chat-contact-violation-enforcement` for the automated enforcement path.
 */
export const OFF_PLATFORM_TEMP_BAN_DAYS = 90;

export const OFF_PLATFORM_BAN_NOTICE =
  "Any Trainer found soliciting or accepting payments off-platform for clients first discovered through Match Fit is subject to a temporary suspension on the first substantiated occurrence and a permanent ban on a second, in addition to other remedies available to Match Fit under these Terms or applicable law.";

/** Client-facing chat reminder (trainers see tier-specific notices in chat UI). */
export const OFF_PLATFORM_CLIENT_CHAT_NOTICE =
  "Keep payments and scheduling on Match Fit. Messages that look like off-platform payment requests or hidden contact info may be flagged for review.";

export const OFF_PLATFORM_ELITE_TRAINER_CHAT_NOTICE =
  "Elite Fitness Pro may share business email addresses in chat. Phone numbers and off-platform payment details are still not allowed.";
