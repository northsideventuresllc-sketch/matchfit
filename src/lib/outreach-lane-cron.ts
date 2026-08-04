import "server-only";

import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { fireOutreachAxonEvent, type OutreachAxonLeadRef } from "@/lib/outreach-axon-notify";
import { isEstWeekend, startOfEstDayUtc } from "@/lib/outreach-lanes";
import { OUTREACH_FOLLOW_UP_REMINDER_INTERVAL_HOURS } from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";
import { scopedToMatchFit } from "@/lib/outreach-venture-scope";

const MS_HOUR = 3_600_000;

export type OutreachPastDueFlipSummary = {
  instagram: number;
  facebook: number;
  email: number;
  total: number;
};

/**
 * Past-due flip: every lead still in the `today` lane whose `queuedForDate` is before the current
 * America/New_York calendar day moves to the `past_due` lane. Runs daily at 11:59pm ET.
 */
export async function processOutreachPastDueFlip(now = new Date()): Promise<OutreachPastDueFlipSummary> {
  await ensureOutreachHubSchema();
  const startOfToday = startOfEstDayUtc(now);
  // Match Fit lane only. Another venture's leads follow their own cron and their own send key.
  const where = scopedToMatchFit({
    deletedAt: null,
    outreachLane: "today",
    queuedForDate: { lt: startOfToday },
  });
  const data = { outreachLane: "past_due" };

  const [ig, fb, em] = await Promise.all([
    prisma.outreachInstagramLead.updateMany({ where, data }),
    prisma.outreachFacebookLead.updateMany({ where, data }),
    prisma.outreachEmailLead.updateMany({ where, data }),
  ]);

  return {
    instagram: ig.count,
    facebook: fb.count,
    email: em.count,
    total: ig.count + fb.count + em.count,
  };
}

export type OutreachFollowUpReminderSummary = {
  followUp1Reminded: number;
  followUp2Reminded: number;
  total: number;
  /** Plain-language reason the run did nothing, when it deliberately skipped. */
  skippedReason: string | null;
};

type FollowUpStage = "follow_up_1" | "follow_up_2";

/** Safety cap so one bad day can't fire a hundred Telegram nudges at JB in a single run. */
const MAX_REMINDERS_PER_STAGE = 50;

/**
 * Claims one lead's reminder slot atomically.
 *
 * The claim is the stamp: a single UPDATE that only matches while the last-reminded time is still
 * null / older than the cutoff. Postgres row-locks it, so if two cron runs overlap (a retried
 * GitHub Actions job, or a manual `workflow_dispatch` on top of the hourly schedule) exactly one
 * of them gets `count === 1` and the other gets 0 — JB gets one nudge, not two.
 */
async function claimReminder(
  platform: "instagram" | "email",
  id: string,
  remindedField: string,
  now: Date,
  reminderCutoff: Date,
): Promise<boolean> {
  const where = {
    id,
    OR: [{ [remindedField]: null }, { [remindedField]: { lte: reminderCutoff } }],
  } as Record<string, unknown>;
  const data = { [remindedField]: now } as Record<string, unknown>;
  const result =
    platform === "instagram"
      ? await prisma.outreachInstagramLead.updateMany({ where: where as never, data: data as never })
      : await prisma.outreachEmailLead.updateMany({ where: where as never, data: data as never });
  return result.count === 1;
}

async function remindStage(
  stage: FollowUpStage,
  now: Date,
  reminderCutoff: Date,
): Promise<OutreachAxonLeadRef[]> {
  const dueField = stage === "follow_up_1" ? "followUp1DueAt" : "followUp2DueAt";
  const remindedField =
    stage === "follow_up_1" ? "followUp1LastRemindedAt" : "followUp2LastRemindedAt";

  // Match Fit lane only — an NI Services lead must never be chased by the Match Fit cron,
  // which sends with the Match Fit Resend key.
  const where = scopedToMatchFit({
    deletedAt: null,
    archivedAt: null,
    // A lead marked dead, or one that has already replied and is waiting on JB's response, must
    // never be chased for a follow-up. Both normally leave the follow-up lane on their own; these
    // guards mean a half-applied lane update can't turn into a wrong nudge.
    deadLeadAt: null,
    hasUnrespondedReply: false,
    outreachLane: stage,
    [dueField]: { lte: now },
    OR: [{ [remindedField]: null }, { [remindedField]: { lte: reminderCutoff } }],
  }) as Record<string, unknown>;

  const [igLeads, emLeads] = await Promise.all([
    prisma.outreachInstagramLead.findMany({
      where: where as never,
      select: { id: true, handle: true, profileUrl: true },
      take: MAX_REMINDERS_PER_STAGE,
    }),
    prisma.outreachEmailLead.findMany({
      where: where as never,
      select: { id: true, name: true, email: true },
      take: MAX_REMINDERS_PER_STAGE,
    }),
  ]);

  const refs: OutreachAxonLeadRef[] = [];
  for (const l of igLeads) {
    if (!(await claimReminder("instagram", l.id, remindedField, now, reminderCutoff))) continue;
    refs.push({
      platform: "instagram",
      leadId: l.id,
      handle: l.handle,
      contact: l.profileUrl,
      summary: stage,
    });
  }
  for (const l of emLeads) {
    if (!(await claimReminder("email", l.id, remindedField, now, reminderCutoff))) continue;
    refs.push({
      platform: "email",
      leadId: l.id,
      handle: l.name,
      contact: l.email,
      summary: stage,
    });
  }
  return refs;
}

/**
 * Follow-up reminder cron (runs at least hourly): for leads in `follow_up_1` / `follow_up_2`
 * whose due time has passed and which were last reminded > 24h ago (or never), fire an AXON
 * `follow_up_due` event and stamp the last-reminded time. Keeps re-nudging every 24h until the
 * lead leaves the follow-up lane (i.e. JB approves the follow-up). Facebook has no follow-up lane.
 *
 * Both Instagram and email leads are covered — the two platforms that have a follow-up pipeline.
 *
 * This only ever NOTIFIES. It never approves, sends, or queues a dispatch, so a follow-up cannot
 * reach a coach without JB pressing approve. Leads only enter a follow-up lane once a dispatch
 * batch he approved reported the first message as sent, so a lead whose message was never
 * approved is never chased.
 *
 * Weekends are skipped outright (America/New_York): outreach reaches JB Monday–Friday only. The
 * skip happens before anything is stamped, so a Saturday due date still nudges him on Monday
 * instead of being silently consumed by a weekend run.
 */
export async function processOutreachFollowUpReminders(
  now = new Date(),
): Promise<OutreachFollowUpReminderSummary> {
  if (isEstWeekend(now)) {
    return {
      followUp1Reminded: 0,
      followUp2Reminded: 0,
      total: 0,
      skippedReason: "Weekend — follow-up reminders only go out Monday to Friday.",
    };
  }

  await ensureOutreachHubSchema();
  const reminderCutoff = new Date(now.getTime() - OUTREACH_FOLLOW_UP_REMINDER_INTERVAL_HOURS * MS_HOUR);

  const fu1 = await remindStage("follow_up_1", now, reminderCutoff);
  const fu2 = await remindStage("follow_up_2", now, reminderCutoff);

  if (fu1.length > 0) {
    await fireOutreachAxonEvent({
      eventType: "follow_up_due",
      leads: fu1,
      meta: { followUpStage: "follow_up_1" },
    });
  }
  if (fu2.length > 0) {
    await fireOutreachAxonEvent({
      eventType: "follow_up_due",
      leads: fu2,
      meta: { followUpStage: "follow_up_2" },
    });
  }

  return {
    followUp1Reminded: fu1.length,
    followUp2Reminded: fu2.length,
    total: fu1.length + fu2.length,
    skippedReason: null,
  };
}
