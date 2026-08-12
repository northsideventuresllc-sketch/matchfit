import { prisma } from "@/lib/prisma";
import {
  applyTrainerMarketplaceSuspensionSideEffects,
  notifyClientsTrainerSuspensionLifted,
} from "@/lib/trainer-suspension-marketplace";

/**
 * Two-strike chat contact-info ban (JB, 2026-08-07): replaces the old $1,000 "Liquidated Damages
 * Fee" text with a real, automated enforcement path. First substantiated violation (a chat
 * message blocked for a phone number or personal email — see
 * `isContactInfoViolationSignal` in `@/lib/chat-leakage-detection`) gets a temporary suspension;
 * a second substantiated violation is permanent. Off-platform-payment-keyword-only blocks
 * (Venmo/PayPal/etc. with no phone/email) do NOT count as a strike here.
 *
 * Strike count is derived from `SuspensionRecord` rows tagged `reason: CHAT_CONTACT_VIOLATION_REASON`
 * for the trainer rather than a separate mutable counter column — the suspension ledger already
 * gives an auditable, timestamped history, and `expiresAt` doubles as the auto-lift instant, so no
 * new Prisma field/migration was needed for this feature.
 */
export const CHAT_CONTACT_VIOLATION_REASON = "CHAT_CONTACT_LEAKAGE";

/** First-offense suspension length. Matches the 90-day figure already used for other Match Fit
 *  deactivation ladders (see Terms §12) — see `OFF_PLATFORM_TEMP_BAN_DAYS`. */
export const CHAT_CONTACT_TEMP_BAN_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FIVE_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 5;

export type ChatContactViolationOutcome =
  | { tier: "temporary"; suspendedUntil: Date }
  | { tier: "permanent" };

/**
 * Records a substantiated chat contact-info violation for a trainer and applies the matching
 * suspension tier. Call this only when the blocked message matched a contact-info signal (phone
 * number or personal email), not for payment-keyword-only blocks.
 */
export async function recordChatContactViolationAndSuspendTrainer(
  trainerId: string,
): Promise<ChatContactViolationOutcome> {
  const priorViolations = await prisma.suspensionRecord.count({
    where: { subjectIsTrainer: true, subjectId: trainerId, reason: CHAT_CONTACT_VIOLATION_REASON },
  });

  const now = new Date();
  const isFirstOffense = priorViolations === 0;
  const expiresAt = isFirstOffense ? new Date(now.getTime() + CHAT_CONTACT_TEMP_BAN_DAYS * MS_PER_DAY) : null;
  const purgeAfter = new Date((expiresAt ?? now).getTime() + FIVE_YEARS_MS);

  await prisma.$transaction([
    prisma.trainer.update({
      where: { id: trainerId },
      data: { safetySuspended: true, safetySuspendedAt: now },
    }),
    prisma.suspensionRecord.create({
      data: {
        subjectIsTrainer: true,
        subjectId: trainerId,
        reason: CHAT_CONTACT_VIOLATION_REASON,
        expiresAt,
        purgeAfter,
      },
    }),
    prisma.trainerNotification.create({
      data: {
        trainerId,
        kind: "COMPLIANCE",
        title: isFirstOffense ? `Account suspended for ${CHAT_CONTACT_TEMP_BAN_DAYS} days` : "Account permanently banned",
        body: isFirstOffense
          ? `Your account was suspended for ${CHAT_CONTACT_TEMP_BAN_DAYS} days after a chat message shared a phone number or personal email. Keep contact details out of Match Fit chat — a second violation results in a permanent ban. Access is restored automatically once the suspension period ends.`
          : "Your account was permanently banned after a second violation of Match Fit's chat contact-info policy (sharing a phone number or personal email in chat).",
        linkHref: "/trainer/account-suspended",
      },
    }),
  ]);

  try {
    await applyTrainerMarketplaceSuspensionSideEffects({
      trainerId,
      reasonCode: "CHAT_CONTACT_LEAKAGE",
    });
  } catch (e) {
    console.error("[chat contact violation] marketplace suspension side effects failed", e);
  }

  return isFirstOffense ? { tier: "temporary", suspendedUntil: expiresAt! } : { tier: "permanent" };
}

/**
 * TOS cron hook: auto-lifts temporary chat-contact suspensions once `expiresAt` passes.
 * Permanent bans (`expiresAt: null`) are never touched here. If a trainer has another suspension
 * still open (a different `SuspensionRecord` with `liftedAt: null` — e.g. an unrelated safety
 * report), `safetySuspended` is left set until that other record is also lifted.
 */
export async function liftExpiredChatContactTempBans(now: Date = new Date()): Promise<number> {
  const due = await prisma.suspensionRecord.findMany({
    where: {
      subjectIsTrainer: true,
      reason: CHAT_CONTACT_VIOLATION_REASON,
      liftedAt: null,
      expiresAt: { lte: now },
    },
    select: { id: true, subjectId: true },
  });

  let lifted = 0;
  for (const record of due) {
    const purgeAfter = new Date(now.getTime() + FIVE_YEARS_MS);
    await prisma.suspensionRecord.update({
      where: { id: record.id },
      data: { liftedAt: now, purgeAfter },
    });

    const stillSuspended = await prisma.suspensionRecord.findFirst({
      where: { subjectIsTrainer: true, subjectId: record.subjectId, liftedAt: null },
      select: { id: true },
    });

    if (!stillSuspended) {
      await prisma.trainer.update({
        where: { id: record.subjectId },
        data: { safetySuspended: false, safetySuspendedAt: null },
      });
      await prisma.trainerNotification.create({
        data: {
          trainerId: record.subjectId,
          kind: "COMPLIANCE",
          title: "Account restored",
          body: `Your ${CHAT_CONTACT_TEMP_BAN_DAYS}-day suspension for sharing contact info in chat has ended. Your account is active again.`,
          linkHref: "/trainer/dashboard",
        },
      });
      try {
        await notifyClientsTrainerSuspensionLifted(record.subjectId);
      } catch (e) {
        console.error("[chat contact violation] restore notify failed", e);
      }
    }

    lifted += 1;
  }

  return lifted;
}
