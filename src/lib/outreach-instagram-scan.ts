import "server-only";

import { archiveHubOutreachLeadOnAdminDelete } from "@/lib/outreach-archive";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { fireOutreachAxonEvent, type OutreachAxonLeadRef } from "@/lib/outreach-axon-notify";
import { normalizeInstagramHandle } from "@/lib/outreach-exclusions";
import { generateOutreachResponseDraft } from "@/lib/outreach-response-draft";
import { prisma } from "@/lib/prisma";

/**
 * Instagram reply scanning. No first-party Instagram API exists, so this uses the Cowork
 * Desktop-Control pattern: we queue an `OutreachCoworkScanJob` describing which DM threads to
 * check, a Cowork session works it, and it posts found replies back to the completion callback
 * (`completeOutreachInstagramScanJob`). Kept deliberately lightweight and swappable.
 */

/** Statuses meaning we sent something and could plausibly get a reply. */
const AWAITING_REPLY_STATUSES = ["OUTREACH_SENT", "FOLLOW_UP_1", "FOLLOW_UP_2"] as const;

export async function createOutreachInstagramScanJob(args: {
  adminId: string;
  limit?: number;
}): Promise<{ jobId: string; candidateCount: number }> {
  await ensureOutreachHubSchema();
  const candidates = await prisma.outreachInstagramLead.findMany({
    where: {
      deletedAt: null,
      archivedAt: null,
      hasUnrespondedReply: false,
      status: { in: [...AWAITING_REPLY_STATUSES] },
    },
    orderBy: { outreachSentAt: "desc" },
    take: args.limit ?? 50,
    select: { id: true, handle: true, profileUrl: true },
  });

  const brief = {
    generatedAt: new Date().toISOString(),
    platform: "instagram",
    instructions: [
      "Open Instagram DMs for the Match Fit account (@theofficialmatchfit).",
      "For each lead below, check whether they replied to our outreach DM since it was sent.",
      "Report only NEW replies not already handled. Include the leadId AND the @handle so we can match it back (handle is used as a fallback when the leadId is missing).",
      "If a reply clearly says they are NOT interested, set notInterested:true on that reply — it will be archived instead of drafted.",
      "Post results to the completion callback as { replies: [{ leadId, handle, preview, notInterested }] }.",
    ],
    leads: candidates.map((c) => ({ leadId: c.id, handle: c.handle, profileUrl: c.profileUrl })),
  };

  const job = await prisma.outreachCoworkScanJob.create({
    data: {
      platform: "instagram",
      status: "queued",
      brief,
      createdByAdminId: args.adminId,
    },
  });

  return { jobId: job.id, candidateCount: candidates.length };
}

export type InstagramScanReply = {
  leadId?: string;
  handle?: string;
  preview?: string;
  /** Agent-classified: the reply says they aren't interested — archive instead of drafting. */
  notInterested?: boolean;
};

/**
 * Completion callback for an Instagram Cowork scan job. Flags each replying lead
 * (`hasUnrespondedReply`, `pending_response` lane), drafts an AI reply, and fires an AXON
 * `pending_response` event. Marks the job complete/failed.
 */
export async function completeOutreachInstagramScanJob(args: {
  jobId: string;
  replies?: InstagramScanReply[];
  error?: string;
  adminId: string;
  now?: Date;
}): Promise<{ matched: string[]; skipped: string[] }> {
  await ensureOutreachHubSchema();
  const now = args.now ?? new Date();

  const job = await prisma.outreachCoworkScanJob.findUnique({ where: { id: args.jobId } });
  if (!job) throw new Error("Scan job not found.");

  if (args.error) {
    await prisma.outreachCoworkScanJob.update({
      where: { id: args.jobId },
      data: { status: "failed", completedAt: now, result: { error: args.error } },
    });
    return { matched: [], skipped: [] };
  }

  const matched: string[] = [];
  const skipped: string[] = [];
  const notifyLeads: OutreachAxonLeadRef[] = [];

  const replies = args.replies ?? [];

  // Resolve referenced leads by id in one query. Handle-only replies (no leadId) are matched by
  // normalized @handle as a fallback — an inbound DM the executor read straight from the inbox
  // won't always carry the leadId, but the username always maps back to the lead row.
  const idsToLookUp = [...new Set(replies.map((r) => r.leadId).filter((v): v is string => !!v))];
  const leadRows = idsToLookUp.length
    ? await prisma.outreachInstagramLead.findMany({
        where: { id: { in: idsToLookUp }, deletedAt: null, archivedAt: null },
      })
    : [];
  const leadById = new Map(leadRows.map((lead) => [lead.id, lead]));

  // Handle fallback: for any reply whose leadId didn't resolve, look the lead up by @handle.
  const handlesToLookUp = [
    ...new Set(
      replies
        .filter((r) => (!r.leadId || !leadById.has(r.leadId)) && r.handle)
        .map((r) => normalizeInstagramHandle(r.handle as string))
        .filter((v): v is string => !!v),
    ),
  ];
  const leadByHandle = new Map<string, (typeof leadRows)[number]>();
  if (handlesToLookUp.length) {
    const handleRows = await prisma.outreachInstagramLead.findMany({
      where: { handle: { in: handlesToLookUp }, deletedAt: null, archivedAt: null },
    });
    for (const row of handleRows) leadByHandle.set(row.handle, row);
  }

  const resolveLead = (reply: InstagramScanReply): (typeof leadRows)[number] | undefined => {
    if (reply.leadId && leadById.has(reply.leadId)) return leadById.get(reply.leadId);
    const norm = reply.handle ? normalizeInstagramHandle(reply.handle) : null;
    return norm ? leadByHandle.get(norm) : undefined;
  };

  // A repeat leadId re-read the same row and wrote the same values, so one
  // update per distinct lead is equivalent — but matched/notifyLeads still get
  // an entry per reply, exactly as before.
  const updatedLeadIds = new Set<string>();
  const updates: ReturnType<typeof prisma.outreachInstagramLead.update>[] = [];
  const draftJobs: { leadId: string; incomingMessage: string | undefined }[] = [];

  for (const reply of replies) {
    const lead = resolveLead(reply);
    if (!lead) {
      skipped.push(reply.leadId ?? reply.handle ?? "unknown");
      continue;
    }
    // "Not interested" replies are archived, not drafted (WF2 item 6.2).
    if (reply.notInterested) {
      if (!updatedLeadIds.has(lead.id)) {
        updatedLeadIds.add(lead.id);
        await archiveHubOutreachLeadOnAdminDelete("instagram", lead.id).catch((e) =>
          console.warn("[outreach-instagram-scan] archive on not-interested failed", e),
        );
      }
      matched.push(lead.id);
      continue;
    }
    if (!updatedLeadIds.has(lead.id)) {
      updatedLeadIds.add(lead.id);
      updates.push(
        prisma.outreachInstagramLead.update({
          where: { id: lead.id },
          data: {
            hasUnrespondedReply: true,
            replyReceivedAt: now,
            responseReceivedAt: lead.responseReceivedAt ?? now,
            status: "RESPONSE_RECEIVED",
            outreachLane: "pending_response",
          },
        }),
      );
    }

    draftJobs.push({ leadId: lead.id, incomingMessage: reply.preview });
    matched.push(lead.id);
    notifyLeads.push({
      platform: "instagram",
      leadId: lead.id,
      handle: lead.handle,
      contact: lead.profileUrl,
      summary: (reply.preview ?? "New Instagram reply").slice(0, 200),
    });
  }

  if (updates.length) await prisma.$transaction(updates);

  // Draft generation stays sequential and one-per-reply: it is an AI call, not a
  // query, and callers rely on the same number of drafts being produced.
  for (const job of draftJobs) {
    await generateOutreachResponseDraft({
      platform: "instagram",
      leadId: job.leadId,
      adminId: args.adminId,
      incomingMessage: job.incomingMessage,
    }).catch((e) => console.warn("[outreach-instagram-scan] draft generation failed", e));
  }

  await prisma.outreachCoworkScanJob.update({
    where: { id: args.jobId },
    data: {
      status: "complete",
      completedAt: now,
      result: { matched: matched.length, skipped: skipped.length, replies: args.replies ?? [] },
    },
  });

  if (notifyLeads.length > 0) {
    await fireOutreachAxonEvent({ eventType: "pending_response", leads: notifyLeads });
  }

  return { matched, skipped };
}
