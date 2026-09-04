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

// WF2 item 3.4 (JB 2026-09-03): comment removed from the IG workflow (repeated spam flags). Follow,
// like recent posts, and DM only — no comment step anywhere in the dispatch brief.
const INSTAGRAM_ACTION_ORDER = ["follow", "like_recent_posts", "dm"] as const;

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
    // A lead queued from Pending Responses carries a drafted reply — send that, not the outbound DM.
    const isReply = r.dispatchPreviousLane === "pending_response" && !!r.pendingResponseDraft;
    const igDm = isReply ? (r.pendingResponseDraft as string) : r.dmText;
    leadRefs.push({ platform: "instagram", leadId: r.id });
    leads.push({
      leadId: r.id,
      platform: "instagram",
      displayName: r.handle,
      contact: r.profileUrl,
      outreachIntent: r.outreachIntent,
      isReply,
      dmText: igDm,
      // WF2 item 3.4 (JB 2026-09-03): commenting was REMOVED from the Instagram workflow — it kept
      // getting the account flagged for spam. The sequence is now follow + like recent posts + DM
      // only. A reply (Pending Responses) is just the DM reply — no follow/like.
      instructions: isReply
        ? [`1) Open ${r.profileUrl}`, `2) Reply in the DM thread: ${igDm}`]
        : [
            `1) Open ${r.profileUrl}`,
            `2) Follow the account`,
            `3) Like their 3–5 most recent posts (any topic)`,
            `4) Send DM: ${igDm}`,
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
    // A reply queued from Pending Responses sends the drafted reply body under a Re: subject.
    const isReply = r.dispatchPreviousLane === "pending_response" && !!r.pendingResponseDraft;
    leadRefs.push({ platform: "email", leadId: r.id });
    leads.push({
      leadId: r.id,
      platform: "email",
      displayName: r.name,
      contact: r.email,
      outreachIntent: r.outreachIntent,
      isReply,
      emailSubject: isReply ? `Re: ${r.emailSubject}` : r.emailSubject,
      emailBody: isReply ? (r.pendingResponseDraft as string) : r.emailBody,
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
 * Lane + timestamp fields to write when a lead's message is marked sent, given the lane it was
 * sent FROM (`previousLane`). Shared by the manual "Mark Sent" toggle and the agent-dispatch
 * completion so both advance the follow-up pipeline identically:
 *   primary (today/past_due/pending/null) -> follow_up_1 (awaiting 1st follow-up, clock armed)
 *   follow_up_1                            -> follow_up_2 (1st follow-up done, clock armed)
 *   follow_up_2                            -> pending     (2nd follow-up done, pipeline complete)
 * Facebook has no follow-up pipeline -> always `pending`.
 */
function advanceSentLaneFields(
  platform: OutreachPlatform,
  previousLane: string | null,
  now: Date,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    status: "OUTREACH_SENT",
    outreachSentAt: now,
    manualSentAt: now,
    sendMode: null,
    dispatchBatchId: null,
    dispatchPreviousLane: null,
  };
  // A reply sent from Pending Responses: the lead has now been answered, so it drops out of the
  // "needs reply" state back into Pending Leads. No follow-up clock is (re)armed by a reply.
  if (previousLane === "pending_response") {
    base.outreachLane = "pending";
    base.hasUnrespondedReply = false;
    return base;
  }
  if (platform === "facebook") {
    base.outreachLane = "pending";
    return base;
  }
  if (previousLane === "follow_up_1") {
    base.outreachLane = "follow_up_2";
    base.followUp1SentAt = now;
    base.followUp2DueAt = new Date(now.getTime() + OUTREACH_FOLLOW_UP_2_DUE_DAYS * MS_DAY);
    return base;
  }
  if (previousLane === "follow_up_2") {
    base.outreachLane = "pending";
    base.followUp2SentAt = now;
    return base;
  }
  // Primary send.
  base.outreachLane = "follow_up_1";
  base.followUp1DueAt = new Date(now.getTime() + OUTREACH_FOLLOW_UP_1_DUE_HOURS * MS_HOUR);
  base.followUp2DueAt = new Date(now.getTime() + OUTREACH_FOLLOW_UP_2_DUE_DAYS * MS_DAY);
  return base;
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

  // WF2 item 4/6 (JB 2026-09-03): a "Mark Sent" always lands the lead in the Pending Leads tab,
  // which now aggregates the follow-up lanes. WHICH lane depends on what was just sent
  // (`dispatchPreviousLane`), so the follow-up pipeline advances correctly on every touch:
  //   primary (today/past_due/pending) -> follow_up_1  (awaiting 1st follow-up, clock armed)
  //   follow_up_1                       -> follow_up_2  (1st follow-up done, clock armed)
  //   follow_up_2                       -> pending      (2nd follow-up done, pipeline complete)
  // Facebook has no follow-up pipeline, so it goes straight to `pending`.
  const data = advanceSentLaneFields(args.platform, state.dispatchPreviousLane, now);
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
      // Same stage-aware advance as the manual "Mark Sent" toggle, keyed off the lane the lead
      // was queued from, so an agent-sent follow-up advances the pipeline just like a manual one.
      const base = advanceSentLaneFields(platform, prevLaneById.get(result.leadId) ?? null, now);
      delete base.manualSentAt; // agent send, not a manual toggle
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
