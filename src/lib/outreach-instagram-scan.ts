import "server-only";

import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { fireOutreachAxonEvent, type OutreachAxonLeadRef } from "@/lib/outreach-axon-notify";
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
      "Open Instagram DMs for the Match Fit account.",
      "For each lead below, check whether they replied to our outreach DM since it was sent.",
      "Report only NEW replies not already handled. Include the leadId so we can match it back.",
      "Post results to the completion callback as { replies: [{ leadId, handle, preview }] }.",
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

export type InstagramScanReply = { leadId: string; handle?: string; preview?: string };

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

  for (const reply of args.replies ?? []) {
    const lead = await prisma.outreachInstagramLead.findFirst({
      where: { id: reply.leadId, deletedAt: null, archivedAt: null },
    });
    if (!lead) {
      skipped.push(reply.leadId);
      continue;
    }
    await prisma.outreachInstagramLead.update({
      where: { id: lead.id },
      data: {
        hasUnrespondedReply: true,
        replyReceivedAt: now,
        responseReceivedAt: lead.responseReceivedAt ?? now,
        status: "RESPONSE_RECEIVED",
        outreachLane: "pending_response",
      },
    });
    await generateOutreachResponseDraft({
      platform: "instagram",
      leadId: lead.id,
      adminId: args.adminId,
      incomingMessage: reply.preview,
    }).catch((e) => console.warn("[outreach-instagram-scan] draft generation failed", e));

    matched.push(lead.id);
    notifyLeads.push({
      platform: "instagram",
      leadId: lead.id,
      handle: lead.handle,
      contact: lead.profileUrl,
      summary: (reply.preview ?? "New Instagram reply").slice(0, 200),
    });
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
