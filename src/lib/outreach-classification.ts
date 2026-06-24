import type { OutreachAutoClassification, OutreachLeadStatus, OutreachPlatform } from "@/lib/outreach-types";

const MS_DAY = 86_400_000;

export type OutreachTimeline = {
  status: OutreachLeadStatus | string;
  platform: OutreachPlatform;
  outreachSentAt: Date | null;
  followUp1SentAt: Date | null;
  followUp2SentAt: Date | null;
  responseReceivedAt: Date | null;
  createdAt: Date;
  now?: Date;
};

/**
 * Classify leads for daily ops: active, needs follow-up, unknown, or dead.
 * Facebook page posts skip follow-up stages.
 */
export function classifyOutreachLead(input: OutreachTimeline): OutreachAutoClassification {
  const now = input.now ?? new Date();

  if (input.status === "DEAD_LEAD") {
    return "DEAD_LEAD";
  }

  if (input.responseReceivedAt) {
    return "ACTIVE_LEAD";
  }

  if (input.status === "RESPONSE_RECEIVED") {
    return "ACTIVE_LEAD";
  }

  if (input.status === "LEAD") {
    const ageDays = daysBetween(input.createdAt, now);
    if (ageDays > 14) return "STATUS_UNKNOWN";
    return "ACTIVE_LEAD";
  }

  if (input.platform === "facebook") {
    if (
      input.status === "GROUP_JOIN_REQUESTED" ||
      input.status === "GROUP_JOINED" ||
      input.status === "POST_APPROVED"
    ) {
      return "ACTIVE_LEAD";
    }
    if (input.status === "POST_SUBMITTED_PENDING_REVIEW") {
      const anchor = input.outreachSentAt ?? input.createdAt;
      const daysWaiting = daysBetween(anchor, now);
      if (daysWaiting >= 7) return "FOLLOW_UP_NEEDED";
      return "ACTIVE_LEAD";
    }
    if (input.status === "OUTREACH_SENT") {
      const daysSinceSent = daysBetween(input.outreachSentAt ?? input.createdAt, now);
      if (daysSinceSent >= 14) return "DEAD_LEAD";
      return "ACTIVE_LEAD";
    }
    return "STATUS_UNKNOWN";
  }

  const sentAt = input.outreachSentAt ?? input.followUp1SentAt ?? input.followUp2SentAt;
  if (!sentAt) {
    return "STATUS_UNKNOWN";
  }

  const allowsFollowUp = true;

  if (input.status === "OUTREACH_SENT") {
    const daysSinceSent = daysBetween(sentAt, now);
    if (daysSinceSent >= 14) return "DEAD_LEAD";
    if (allowsFollowUp && daysSinceSent >= 7) return "FOLLOW_UP_NEEDED";
    if (allowsFollowUp && daysSinceSent >= 3) return "FOLLOW_UP_NEEDED";
    return "ACTIVE_LEAD";
  }

  if (input.status === "FOLLOW_UP_1") {
    const daysSinceSent = daysBetween(input.followUp1SentAt ?? sentAt, now);
    if (allowsFollowUp && daysSinceSent >= 4) return "FOLLOW_UP_NEEDED";
    if (daysSinceSent >= 10) return "DEAD_LEAD";
    return "ACTIVE_LEAD";
  }

  if (input.status === "FOLLOW_UP_2") {
    const daysSinceSent = daysBetween(input.followUp2SentAt ?? sentAt, now);
    if (daysSinceSent >= 7) return "DEAD_LEAD";
    return "ACTIVE_LEAD";
  }

  return "STATUS_UNKNOWN";
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / MS_DAY);
}

export function classificationBadgeClass(c: OutreachAutoClassification): string {
  switch (c) {
    case "ACTIVE_LEAD":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    case "FOLLOW_UP_NEEDED":
      return "border-amber-400/30 bg-amber-500/10 text-amber-100";
    case "DEAD_LEAD":
      return "border-white/15 bg-white/[0.04] text-white/45";
    default:
      return "border-sky-400/30 bg-sky-500/10 text-sky-100";
  }
}

export function facebookStatusTimestampsForUpdate(
  status: string,
  existing: { outreachSentAt: Date | null; responseReceivedAt: Date | null },
  now = new Date(),
): { outreachSentAt: Date | null; responseReceivedAt: Date | null } {
  const next = { ...existing };
  const pipelineStatuses = [
    "GROUP_JOIN_REQUESTED",
    "GROUP_JOINED",
    "POST_SUBMITTED_PENDING_REVIEW",
    "POST_APPROVED",
    "OUTREACH_SENT",
  ];
  if (pipelineStatuses.includes(status) && !next.outreachSentAt) {
    next.outreachSentAt = now;
  }
  if (status === "RESPONSE_RECEIVED" && !next.responseReceivedAt) {
    next.responseReceivedAt = now;
  }
  return next;
}

export function statusTimestampsForUpdate(
  status: string,
  existing: {
    outreachSentAt: Date | null;
    followUp1SentAt: Date | null;
    followUp2SentAt: Date | null;
    responseReceivedAt: Date | null;
  },
  now = new Date(),
  previousStatus?: string | null,
): {
  outreachSentAt: Date | null;
  followUp1SentAt: Date | null;
  followUp2SentAt: Date | null;
  responseReceivedAt: Date | null;
} {
  const next = { ...existing };
  const statusChanged = previousStatus !== undefined && previousStatus !== status;

  if (status === "OUTREACH_SENT" && (!next.outreachSentAt || (statusChanged && status === "OUTREACH_SENT"))) {
    next.outreachSentAt = now;
  }
  if (status === "FOLLOW_UP_1" && (!next.followUp1SentAt || (statusChanged && status === "FOLLOW_UP_1"))) {
    next.followUp1SentAt = now;
  }
  if (status === "FOLLOW_UP_2" && (!next.followUp2SentAt || (statusChanged && status === "FOLLOW_UP_2"))) {
    next.followUp2SentAt = now;
  }
  if (status === "RESPONSE_RECEIVED" && (!next.responseReceivedAt || (statusChanged && status === "RESPONSE_RECEIVED"))) {
    next.responseReceivedAt = now;
  }
  return next;
}
