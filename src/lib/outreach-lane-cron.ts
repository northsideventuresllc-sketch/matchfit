import "server-only";

import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { fireOutreachAxonEvent, type OutreachAxonLeadRef } from "@/lib/outreach-axon-notify";
import { startOfEstDayUtc } from "@/lib/outreach-lanes";
import { OUTREACH_FOLLOW_UP_REMINDER_INTERVAL_HOURS } from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";

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
  const where = {
    deletedAt: null,
    outreachLane: "today",
    queuedForDate: { lt: startOfToday },
  } as const;
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
};

type FollowUpStage = "follow_up_1" | "follow_up_2";

async function remindStage(
  stage: FollowUpStage,
  now: Date,
  reminderCutoff: Date,
): Promise<OutreachAxonLeadRef[]> {
  const dueField = stage === "follow_up_1" ? "followUp1DueAt" : "followUp2DueAt";
  const remindedField =
    stage === "follow_up_1" ? "followUp1LastRemindedAt" : "followUp2LastRemindedAt";

  const where = {
    deletedAt: null,
    archivedAt: null,
    outreachLane: stage,
    [dueField]: { lte: now },
    OR: [{ [remindedField]: null }, { [remindedField]: { lte: reminderCutoff } }],
  } as Record<string, unknown>;

  const [igLeads, emLeads] = await Promise.all([
    prisma.outreachInstagramLead.findMany({
      where: where as never,
      select: { id: true, handle: true, profileUrl: true },
    }),
    prisma.outreachEmailLead.findMany({
      where: where as never,
      select: { id: true, name: true, email: true },
    }),
  ]);

  const stamp = { [remindedField]: now } as Record<string, unknown>;
  if (igLeads.length > 0) {
    await prisma.outreachInstagramLead.updateMany({
      where: { id: { in: igLeads.map((l) => l.id) } },
      data: stamp as never,
    });
  }
  if (emLeads.length > 0) {
    await prisma.outreachEmailLead.updateMany({
      where: { id: { in: emLeads.map((l) => l.id) } },
      data: stamp as never,
    });
  }

  return [
    ...igLeads.map(
      (l): OutreachAxonLeadRef => ({
        platform: "instagram",
        leadId: l.id,
        handle: l.handle,
        contact: l.profileUrl,
        summary: stage,
      }),
    ),
    ...emLeads.map(
      (l): OutreachAxonLeadRef => ({
        platform: "email",
        leadId: l.id,
        handle: l.name,
        contact: l.email,
        summary: stage,
      }),
    ),
  ];
}

/**
 * Follow-up reminder cron (runs at least hourly): for leads in `follow_up_1` / `follow_up_2`
 * whose due time has passed and which were last reminded > 24h ago (or never), fire an AXON
 * `follow_up_due` event and stamp the last-reminded time. Keeps re-nudging every 24h until the
 * lead leaves the follow-up lane (i.e. JB approves the follow-up). Facebook has no follow-up lane.
 */
export async function processOutreachFollowUpReminders(
  now = new Date(),
): Promise<OutreachFollowUpReminderSummary> {
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
  };
}
