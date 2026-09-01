import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import {
  OUTREACH_COWORK_EMAIL_BCC,
  OUTREACH_COWORK_EMAIL_FROM,
} from "@/lib/outreach-cowork";
import { nextDispatchSlot } from "@/lib/outreach-lanes";
import {
  OUTREACH_FOLLOW_UP_1_DUE_HOURS,
  OUTREACH_FOLLOW_UP_2_DUE_DAYS,
  type OutreachPlatform,
} from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

/**
 * Literal brief guidance handed to whatever executes the batch (a Cowork Desktop-Control
 * session). This is instruction TEXT, not timing code — the executor spaces the actions itself.
 */
const INSTAGRAM_HUMAN_PACING_GUIDANCE =
  "Space and randomize these actions like a human — do NOT fire them back-to-back in a tight, " +
  "deterministic loop. Vary the order slightly between leads where safe, add irregular pauses " +
  "(tens of seconds to a few minutes) between the DM, follow, likes, and comment, and do not run " +
  "all leads at the exact same cadence. The goal is to avoid looking automated.";

const INSTAGRAM_ACTION_ORDER = ["dm", "follow", "like_3_recent_posts", "comment"] as const;

type LeadRefInput = { id: string; platform: OutreachPlatform };

type DispatchBatchRow = Awaited<
  ReturnType<typeof prisma.outreachCoworkDispatchBatch.findFirst>
>;

async function loadBatchMembers(batchId: string) {
  const [ig, fb, em] = await Promise.all([
    prisma.outreachInstagramLead.findMany({ where: { dispatchBatchId: batchId } }),
    prisma.outreachFacebookLead.findMany({ where: { dispatchBatchId: batchId } }),
    prisma.outreachEmailLead.findMany({ where: { dispatchBatchId: batchId } }),
  ]);
  return { ig, fb, em };
}

function buildBatchBrief(
  batch: NonNullable<DispatchBatchRow>,
  members: Awaited<ReturnType<typeof loadBatchMembers>>,
): { brief: Record<string, unknown>; leadRefs: { platform: OutreachPlatform; leadId: string }[] } {
  const leads: Record<string, unknown>[] = [];
  const leadRefs: { platform: OutreachPlatform; leadId: string }[] = [];

  for (const r of members.ig) {
    leadRefs.push({ platform: "instagram", leadId: r.id });
    leads.push({
      leadId: r.id,
      platform: "instagram",
      displayName: r.handle,
      contact: r.profileUrl,
      outreachIntent: r.outreachIntent,
      dmText: r.dmText,
      commentText: r.commentText,
      commentPostRef: r.commentPostRef ?? "Latest post",
      instructions: [
        `1) Open ${r.profileUrl}`,
        `2) Send DM: ${r.dmText}`,
        "3) Follow the account",
        // Fix #2 (WF2.05) — LIKES vs COMMENT split: likes are any of the 3 most recent posts,
        // any topic (a coach's newest posts are often personal — travel, family, milestones).
        // The comment below is deliberately a SEPARATE, narrower target: only the one post that
        // is actually about coaching content, never the same coaching-specific line reused
        // across all 3 liked posts.
        "4) Like the 3 most recent posts (any topic — likes are not content-specific)",
        r.commentPostRef
          ? `5) Comment ONLY on this specific post (the one confirmed to be about coaching — do NOT reuse this comment on their other recent posts): ${r.commentPostRef}: ${r.commentText}`
          : `5) Find their most recent post that is actually about coaching content (skip travel/family/personal posts) and comment ONLY there — do NOT reuse this comment on their other recent posts: ${r.commentText}`,
      ],
    });
  }

  for (const r of members.fb) {
    leadRefs.push({ platform: "facebook", leadId: r.id });
    leads.push({
      leadId: r.id,
      platform: "facebook",
      displayName: r.pageName,
      contact: r.pageUrl,
      outreachIntent: r.outreachIntent,
      pagePostText: r.pagePostText,
      instructions: [`1) Open ${r.pageUrl}`, `2) Post: ${r.pagePostText}`],
    });
  }

  for (const r of members.em) {
    leadRefs.push({ platform: "email", leadId: r.id });
    leads.push({
      leadId: r.id,
      platform: "email",
      displayName: r.name,
      contact: r.email,
      outreachIntent: r.outreachIntent,
      emailSubject: r.emailSubject,
      emailBody: r.emailBody,
      sendImmediately: true,
      note:
        `Send now (no ordering constraint). Must be sent through ${OUTREACH_COWORK_EMAIL_FROM} and ` +
        `land in that mailbox's Sent folder. BCC: ${OUTREACH_COWORK_EMAIL_BCC.join(", ")}.`,
    });
  }

  const brief: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    slot: batch.slot,
    scheduledFor: batch.scheduledFor.toISOString(),
    emailFrom: OUTREACH_COWORK_EMAIL_FROM,
    emailBcc: OUTREACH_COWORK_EMAIL_BCC,
    instagramActionOrder: INSTAGRAM_ACTION_ORDER,
    instagramHumanPacingGuidance: INSTAGRAM_HUMAN_PACING_GUIDANCE,
    leads,
  };
  return { brief, leadRefs };
}

async function rebuildBatchBrief(batch: NonNullable<DispatchBatchRow>): Promise<void> {
  const members = await loadBatchMembers(batch.id);
  const { brief, leadRefs } = buildBatchBrief(batch, members);
  await prisma.outreachCoworkDispatchBatch.update({
    where: { id: batch.id },
    data: {
      brief: brief as Prisma.InputJsonValue,
      leadRefs: leadRefs as unknown as Prisma.InputJsonValue,
    },
  });
}

async function findOrCreateUpcomingBatch(
  adminId: string,
  now: Date,
): Promise<NonNullable<DispatchBatchRow>> {
  const { slot, scheduledFor } = nextDispatchSlot(now);
  const existing = await prisma.outreachCoworkDispatchBatch.findFirst({
    where: { status: "queued", scheduledFor },
  });
  if (existing) return existing;
  return prisma.outreachCoworkDispatchBatch.create({
    data: {
      scheduledFor,
      slot,
      status: "queued",
      brief: {},
      createdByAdminId: adminId,
    },
  });
}

async function findLeadPlatform(id: string): Promise<OutreachPlatform | null> {
  const [ig, fb, em] = await Promise.all([
    prisma.outreachInstagramLead.findUnique({ where: { id }, select: { id: true, outreachLane: true } }),
    prisma.outreachFacebookLead.findUnique({ where: { id }, select: { id: true, outreachLane: true } }),
    prisma.outreachEmailLead.findUnique({ where: { id }, select: { id: true, outreachLane: true } }),
  ]);
  if (ig) return "instagram";
  if (fb) return "facebook";
  if (em) return "email";
  return null;
}

async function setLeadLaneFields(
  platform: OutreachPlatform,
  id: string,
  data: Record<string, unknown>,
) {
  if (platform === "instagram") return prisma.outreachInstagramLead.update({ where: { id }, data });
  if (platform === "facebook") return prisma.outreachFacebookLead.update({ where: { id }, data });
  return prisma.outreachEmailLead.update({ where: { id }, data });
}

async function getLeadLaneState(
  platform: OutreachPlatform,
  id: string,
): Promise<{ outreachLane: string; dispatchBatchId: string | null; dispatchPreviousLane: string | null } | null> {
  const select = { outreachLane: true, dispatchBatchId: true, dispatchPreviousLane: true };
  if (platform === "instagram") return prisma.outreachInstagramLead.findUnique({ where: { id }, select });
  if (platform === "facebook") return prisma.outreachFacebookLead.findUnique({ where: { id }, select });
  return prisma.outreachEmailLead.findUnique({ where: { id }, select });
}

/**
 * Adds the given leads to the next upcoming 1pm/4pm dispatch batch (creating it if needed),
 * flipping each into the `dispatch_queued` lane and recording the lane to restore on pull.
 * Already-queued or missing leads are skipped. Rebuilds the batch brief afterward.
 */
export async function queueOutreachDispatch(args: {
  leads: LeadRefInput[];
  adminId: string;
  now?: Date;
}): Promise<{ batchId: string; slot: string | null; scheduledFor: string; queued: string[]; skipped: string[] }> {
  await ensureOutreachHubSchema();
  const now = args.now ?? new Date();
  const batch = await findOrCreateUpcomingBatch(args.adminId, now);

  const queued: string[] = [];
  const skipped: string[] = [];

  for (const ref of args.leads) {
    const state = await getLeadLaneState(ref.platform, ref.id);
    if (!state) {
      skipped.push(ref.id);
      continue;
    }
    if (state.outreachLane === "dispatch_queued" || state.dispatchBatchId) {
      // Already queued (this or another batch) — don't clobber its saved previous lane.
      skipped.push(ref.id);
      continue;
    }
    await setLeadLaneFields(ref.platform, ref.id, {
      outreachLane: "dispatch_queued",
      dispatchBatchId: batch.id,
      dispatchPreviousLane: state.outreachLane,
      sendMode: "agent",
      manualSentAt: null,
    });
    queued.push(ref.id);
  }

  await rebuildBatchBrief(batch);

  return {
    batchId: batch.id,
    slot: batch.slot,
    scheduledFor: batch.scheduledFor.toISOString(),
    queued,
    skipped,
  };
}

/**
 * Pulls leads back out of their dispatch batch before it fires: restores each to its
 * `dispatchPreviousLane` and clears the dispatch FK/snapshot. Rebuilds affected batch briefs.
 */
export async function pullOutreachDispatch(args: {
  leadIds: string[];
  now?: Date;
}): Promise<{ pulled: string[]; skipped: string[] }> {
  await ensureOutreachHubSchema();
  const pulled: string[] = [];
  const skipped: string[] = [];
  const affectedBatchIds = new Set<string>();

  for (const id of args.leadIds) {
    const platform = await findLeadPlatform(id);
    if (!platform) {
      skipped.push(id);
      continue;
    }
    const state = await getLeadLaneState(platform, id);
    if (!state || state.outreachLane !== "dispatch_queued") {
      skipped.push(id);
      continue;
    }
    if (state.dispatchBatchId) affectedBatchIds.add(state.dispatchBatchId);
    await setLeadLaneFields(platform, id, {
      outreachLane: state.dispatchPreviousLane ?? "pending",
      dispatchBatchId: null,
      dispatchPreviousLane: null,
    });
    pulled.push(id);
  }

  for (const batchId of affectedBatchIds) {
    const batch = await prisma.outreachCoworkDispatchBatch.findUnique({ where: { id: batchId } });
    if (batch && batch.status === "queued") await rebuildBatchBrief(batch);
  }

  return { pulled, skipped };
}

/**
 * Manual Send: flips the given leads into the `dispatch_queued` lane with sendMode="manual" and no
 * dispatch batch — they show on the Send Queue tab's Manual section with a sent/not-sent toggle
 * (`setManualSentState`) instead of an agent-scheduled date/time. Already-queued leads are skipped.
 */
export async function queueManualSend(args: {
  leads: LeadRefInput[];
}): Promise<{ queued: string[]; skipped: string[] }> {
  await ensureOutreachHubSchema();
  const queued: string[] = [];
  const skipped: string[] = [];

  for (const ref of args.leads) {
    const state = await getLeadLaneState(ref.platform, ref.id);
    if (!state) {
      skipped.push(ref.id);
      continue;
    }
    if (state.outreachLane === "dispatch_queued" || state.dispatchBatchId) {
      skipped.push(ref.id);
      continue;
    }
    await setLeadLaneFields(ref.platform, ref.id, {
      outreachLane: "dispatch_queued",
      dispatchBatchId: null,
      dispatchPreviousLane: state.outreachLane,
      sendMode: "manual",
      manualSentAt: null,
    });
    queued.push(ref.id);
  }

  return { queued, skipped };
}

/**
 * Cancel an Agent Send: pulls a lead out of its Cowork dispatch batch (if any) without dropping it
 * out of the send queue — it stays in `dispatch_queued`, flips to sendMode="manual", and reappears
 * under the Send Queue tab's Manual section for a manual sent/not-sent toggle.
 */
export async function convertAgentSendToManual(args: {
  leadIds: string[];
}): Promise<{ converted: string[]; skipped: string[] }> {
  await ensureOutreachHubSchema();
  const converted: string[] = [];
  const skipped: string[] = [];
  const affectedBatchIds = new Set<string>();

  for (const id of args.leadIds) {
    const platform = await findLeadPlatform(id);
    if (!platform) {
      skipped.push(id);
      continue;
    }
    const state = await getLeadLaneState(platform, id);
    if (!state || state.outreachLane !== "dispatch_queued") {
      skipped.push(id);
      continue;
    }
    if (state.dispatchBatchId) affectedBatchIds.add(state.dispatchBatchId);
    await setLeadLaneFields(platform, id, {
      dispatchBatchId: null,
      sendMode: "manual",
      manualSentAt: null,
    });
    converted.push(id);
  }

  for (const batchId of affectedBatchIds) {
    const batch = await prisma.outreachCoworkDispatchBatch.findUnique({ where: { id: batchId } });
    if (batch && batch.status === "queued") await rebuildBatchBrief(batch);
  }

  return { converted, skipped };
}

/**
 * Send Queue "Manual" sent/not-sent toggle. Marking sent mirrors the same lane transition as a
 * successful agent dispatch (`completeOutreachDispatchBatch`'s "sent" branch): status flips to
 * OUTREACH_SENT, and the lead moves into the follow-up pipeline (or `pending` for Facebook, which
 * has none). Marking not-sent just clears the timestamp — the lead stays in the Manual queue.
 */
export async function setManualSentState(args: {
  id: string;
  platform: OutreachPlatform;
  sent: boolean;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureOutreachHubSchema();
  const now = args.now ?? new Date();
  const state = await getLeadLaneState(args.platform, args.id);
  if (!state) return { ok: false, error: "Lead not found." };
  if (state.outreachLane !== "dispatch_queued") {
    return { ok: false, error: "Lead is not in the Send Queue." };
  }

  if (!args.sent) {
    await setLeadLaneFields(args.platform, args.id, { manualSentAt: null });
    return { ok: true };
  }

  const data: Record<string, unknown> = {
    status: "OUTREACH_SENT",
    outreachSentAt: now,
    manualSentAt: now,
    sendMode: null,
    dispatchBatchId: null,
    dispatchPreviousLane: null,
  };
  if (args.platform === "facebook") {
    data.outreachLane = "pending";
  } else {
    data.outreachLane = "follow_up_1";
    data.followUp1DueAt = new Date(now.getTime() + OUTREACH_FOLLOW_UP_1_DUE_HOURS * MS_HOUR);
    data.followUp2DueAt = new Date(now.getTime() + OUTREACH_FOLLOW_UP_2_DUE_DAYS * MS_DAY);
  }
  await setLeadLaneFields(args.platform, args.id, data);
  return { ok: true };
}

/**
 * Upcoming (not-yet-completed) batches plus batches completed in the last 24h. Anything completed
 * more than 24h ago is filtered out at query time (mirrors "disappears after 24h") — not deleted.
 */
export async function listOutreachDispatchBatches(now = new Date()): Promise<{
  upcoming: NonNullable<DispatchBatchRow>[];
  recentlyCompleted: NonNullable<DispatchBatchRow>[];
}> {
  await ensureOutreachHubSchema();
  const cutoff = new Date(now.getTime() - 24 * MS_HOUR);
  const [upcoming, recentlyCompleted] = await Promise.all([
    prisma.outreachCoworkDispatchBatch.findMany({
      where: { status: { in: ["queued", "dispatched", "running"] } },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.outreachCoworkDispatchBatch.findMany({
      where: { status: { in: ["complete", "failed"] }, completedAt: { gte: cutoff } },
      orderBy: { completedAt: "desc" },
    }),
  ]);
  return { upcoming, recentlyCompleted };
}

export type DispatchCompletionResult = { leadId: string; status: "sent" | "failed"; detail?: string };

/**
 * Completion callback: marks the batch complete and moves each lead. Successful sends go to the
 * follow-up pipeline (Instagram/email: `follow_up_1` lane with FU1 due at 48h and FU2 due at 5
 * days, per the Cowork SOP cadence; Facebook has no follow-up pipeline so it lands in `pending`).
 * Failed sends revert to their `dispatchPreviousLane`, with the error surfaced in the batch result.
 */
export async function completeOutreachDispatchBatch(args: {
  batchId: string;
  results: DispatchCompletionResult[];
  now?: Date;
}): Promise<{ sent: number; failed: number; unknown: number }> {
  await ensureOutreachHubSchema();
  const now = args.now ?? new Date();
  const batch = await prisma.outreachCoworkDispatchBatch.findUnique({ where: { id: args.batchId } });
  if (!batch) throw new Error("Dispatch batch not found.");

  const members = await loadBatchMembers(args.batchId);
  const platformById = new Map<string, OutreachPlatform>();
  const prevLaneById = new Map<string, string | null>();
  for (const r of members.ig) {
    platformById.set(r.id, "instagram");
    prevLaneById.set(r.id, r.dispatchPreviousLane);
  }
  for (const r of members.fb) {
    platformById.set(r.id, "facebook");
    prevLaneById.set(r.id, r.dispatchPreviousLane);
  }
  for (const r of members.em) {
    platformById.set(r.id, "email");
    prevLaneById.set(r.id, r.dispatchPreviousLane);
  }

  let sent = 0;
  let failed = 0;
  let unknown = 0;

  for (const result of args.results) {
    const platform = platformById.get(result.leadId);
    if (!platform) {
      unknown += 1;
      continue;
    }
    if (result.status === "sent") {
      const base: Record<string, unknown> = {
        status: "OUTREACH_SENT",
        outreachSentAt: now,
        dispatchBatchId: null,
        dispatchPreviousLane: null,
      };
      if (platform === "facebook") {
        base.outreachLane = "pending";
      } else {
        base.outreachLane = "follow_up_1";
        base.followUp1DueAt = new Date(now.getTime() + OUTREACH_FOLLOW_UP_1_DUE_HOURS * MS_HOUR);
        base.followUp2DueAt = new Date(now.getTime() + OUTREACH_FOLLOW_UP_2_DUE_DAYS * MS_DAY);
      }
      await setLeadLaneFields(platform, result.leadId, base);
      sent += 1;
    } else {
      await setLeadLaneFields(platform, result.leadId, {
        outreachLane: prevLaneById.get(result.leadId) ?? "pending",
        dispatchBatchId: null,
        dispatchPreviousLane: null,
      });
      failed += 1;
    }
  }

  await prisma.outreachCoworkDispatchBatch.update({
    where: { id: args.batchId },
    data: {
      status: "complete",
      completedAt: now,
      result: {
        completedAt: now.toISOString(),
        results: args.results,
        sent,
        failed,
        unknown,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return { sent, failed, unknown };
}
