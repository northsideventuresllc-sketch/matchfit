import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { OutreachPlatform, OutreachTouchStage } from "@/lib/outreach-types";

export type TouchMessageField = { label: string; text: string };

/**
 * initial | follow_up_1 | follow_up_2 | reply — derived from the lane a send completed FROM
 * (`dispatchPreviousLane`). Mirrors the same branching `advanceSentLaneFields()` in
 * outreach-dispatch.ts already uses to pick the next lane.
 */
export function stageForPreviousLane(previousLane: string | null): OutreachTouchStage {
  if (previousLane === "pending_response") return "reply";
  if (previousLane === "follow_up_1") return "follow_up_1";
  if (previousLane === "follow_up_2") return "follow_up_2";
  return "initial";
}

/**
 * The message text actually sent for this stage, off the raw lead row loaded at send-completion
 * time. Mirrors the stage-aware selection `manualQueueMessageFields()` in
 * v2/components/helpers.ts already uses, generalized to the plain Prisma row shape both
 * send-completion paths in outreach-dispatch.ts have on hand (rather than the serialized
 * `OutreachHubLead` UI type that helper expects).
 */
export function snapshotMessageFieldsForTouch(
  platform: OutreachPlatform,
  stage: OutreachTouchStage,
  lead: Record<string, unknown>,
): TouchMessageField[] {
  const out: TouchMessageField[] = [];
  const str = (key: string): string | undefined =>
    typeof lead[key] === "string" && lead[key] ? (lead[key] as string) : undefined;

  if (stage === "reply") {
    const draft = str("pendingResponseDraft");
    if (draft) out.push({ label: "Reply", text: draft });
    return out;
  }

  if (platform === "instagram") {
    if (stage === "follow_up_1") {
      const t = str("followUp1DmText");
      if (t) out.push({ label: "First follow-up DM", text: t });
    } else if (stage === "follow_up_2") {
      const t = str("followUp2DmText");
      if (t) out.push({ label: "Second follow-up DM", text: t });
    } else {
      const dm = str("dmText");
      const comment = str("commentText");
      if (dm) out.push({ label: "First DM", text: dm });
      if (comment) out.push({ label: "Comment", text: comment });
    }
  } else if (platform === "facebook") {
    const post = str("pagePostText");
    if (post) out.push({ label: "Page post", text: post });
  } else {
    if (stage === "follow_up_1") {
      const subject = str("followUp1EmailSubject");
      const body = str("followUp1EmailBody");
      if (subject) out.push({ label: "First follow-up subject", text: subject });
      if (body) out.push({ label: "First follow-up email", text: body });
    } else if (stage === "follow_up_2") {
      const subject = str("followUp2EmailSubject");
      const body = str("followUp2EmailBody");
      if (subject) out.push({ label: "Second follow-up subject", text: subject });
      if (body) out.push({ label: "Second follow-up email", text: body });
    } else {
      const subject = str("emailSubject");
      const body = str("emailBody");
      if (subject) out.push({ label: "Subject", text: subject });
      if (body) out.push({ label: "Body", text: body });
    }
  }
  return out;
}

/**
 * Records one completed send touch (Send Queue completion, manual or agent) to
 * `outreach_lead_touch_log`. `sendMode` is always a literal from the caller's own context
 * (never read back off the lead row's mutable `sendMode` column) so history stays correct
 * regardless of that column's lifecycle. Best-effort: a logging failure must never break an
 * already-completed send, so this never throws — it logs and returns.
 */
export async function recordOutreachTouch(args: {
  platform: OutreachPlatform;
  leadId: string;
  stage: OutreachTouchStage;
  sentAt: Date;
  sendMode: "manual" | "agent";
  messageFields: TouchMessageField[];
  dispatchBatchId?: string | null;
  performedByAdminId?: string | null;
}): Promise<void> {
  if (args.messageFields.length === 0) return;
  try {
    await prisma.outreachLeadTouchLog.create({
      data: {
        platform: args.platform,
        leadId: args.leadId,
        stage: args.stage,
        sentAt: args.sentAt,
        sendMode: args.sendMode,
        messageFields: args.messageFields as unknown as Prisma.InputJsonValue,
        dispatchBatchId: args.dispatchBatchId ?? null,
        performedByAdminId: args.performedByAdminId ?? null,
        reconstructed: false,
      },
    });
  } catch (e) {
    console.error("[recordOutreachTouch] failed to log touch (send already completed)", e);
  }
}
