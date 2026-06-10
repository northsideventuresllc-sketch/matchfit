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

  const sentAt = input.outreachSentAt ?? input.followUp1SentAt ?? input.followUp2SentAt;
  if (!sentAt) {
    return "STATUS_UNKNOWN";
  }

  const daysSinceSent = daysBetween(sentAt, now);
  const allowsFollowUp = input.platform !== "facebook";

  if (input.status === "OUTREACH_SENT") {
    if (daysSinceSent >= 14) return "DEAD_LEAD";
    if (allowsFollowUp && daysSinceSent >= 7) return "FOLLOW_UP_NEEDED";
    if (allowsFollowUp && daysSinceSent >= 3) return "FOLLOW_UP_NEEDED";
    return "ACTIVE_LEAD";
  }

  if (input.status === "FOLLOW_UP_1") {
    if (allowsFollowUp && daysSinceSent >= 4) return "FOLLOW_UP_NEEDED";
    if (daysSinceSent >= 10) return "DEAD_LEAD";
    return "ACTIVE_LEAD";
  }

  if (input.status === "FOLLOW_UP_2") {
    if (daysSinceSent >= 7) return "DEAD_LEAD";
    return "FOLLOW_UP_NEEDED";
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

export function statusTimestampsForUpdate(
  status: OutreachLeadStatus,
  existing: {
    outreachSentAt: Date | null;
    followUp1SentAt: Date | null;
    followUp2SentAt: Date | null;
    responseReceivedAt: Date | null;
  },
  now = new Date(),
): {
  outreachSentAt: Date | null;
  followUp1SentAt: Date | null;
  followUp2SentAt: Date | null;
  responseReceivedAt: Date | null;
} {
  const next = { ...existing };
  if (status === "OUTREACH_SENT" && !next.outreachSentAt) next.outreachSentAt = now;
  if (status === "FOLLOW_UP_1" && !next.followUp1SentAt) next.followUp1SentAt = now;
  if (status === "FOLLOW_UP_2" && !next.followUp2SentAt) next.followUp2SentAt = now;
  if (status === "RESPONSE_RECEIVED" && !next.responseReceivedAt) next.responseReceivedAt = now;
  return next;
}
