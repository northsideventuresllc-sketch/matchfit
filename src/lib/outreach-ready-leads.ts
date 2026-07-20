/**
 * Ready-lead definition for REV-FIRST / MF-REV-REFILL.
 * A lead is "ready" for JB daily send blocks when it is in Outreach Hub,
 * status LEAD, intent Join as Fitness Pro or Both, and has sendable copy.
 */

import type { OutreachPlatform } from "@/lib/outreach-types";

export const OUTREACH_READY_INTENTS = ["JOIN_AS_FP", "BOTH"] as const;
export type OutreachReadyIntent = (typeof OUTREACH_READY_INTENTS)[number];

/** Default pipeline floor before JB daily send blocks (REV-FIRST). */
export const OUTREACH_READY_LEAD_TARGET = 15;

export function isOutreachReadyIntent(value: unknown): value is OutreachReadyIntent {
  return (
    typeof value === "string" &&
    (OUTREACH_READY_INTENTS as readonly string[]).includes(value)
  );
}

export type OutreachReadyLeadLike = {
  id?: string;
  status?: string | null;
  outreachIntent?: string | null;
  savedToHubAt?: Date | string | null;
  deletedAt?: Date | string | null;
  archivedAt?: Date | string | null;
  dmText?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
};

export function hasOutreachSendableCopy(
  platform: Exclude<OutreachPlatform, "facebook">,
  lead: OutreachReadyLeadLike,
): boolean {
  if (platform === "instagram") {
    return Boolean(lead.dmText?.trim());
  }
  return Boolean(lead.emailSubject?.trim() && lead.emailBody?.trim());
}

/** Hub-saved, unsent Join-as-FP/Both lead with copy — safe for Cowork brief / daily send. */
export function isOutreachReadyLead(
  platform: Exclude<OutreachPlatform, "facebook">,
  lead: OutreachReadyLeadLike,
): boolean {
  if (lead.deletedAt || lead.archivedAt) return false;
  if (lead.status !== "LEAD") return false;
  if (!lead.savedToHubAt) return false;
  if (!isOutreachReadyIntent(lead.outreachIntent)) return false;
  return hasOutreachSendableCopy(platform, lead);
}

export function countOutreachReadyLeads(args: {
  instagram: OutreachReadyLeadLike[];
  email: OutreachReadyLeadLike[];
}): { instagram: number; email: number; total: number; meetsTarget: boolean } {
  const instagram = args.instagram.filter((row) => isOutreachReadyLead("instagram", row)).length;
  const email = args.email.filter((row) => isOutreachReadyLead("email", row)).length;
  const total = instagram + email;
  return {
    instagram,
    email,
    total,
    meetsTarget: total >= OUTREACH_READY_LEAD_TARGET,
  };
}

/** Prefer ready Join-as-FP/Both hub leads, then fill remaining slots from other LEADs. */
export function pickCoworkBriefLeads<T extends OutreachReadyLeadLike>(
  platform: Exclude<OutreachPlatform, "facebook">,
  leads: T[],
  cap: number,
): T[] {
  if (cap <= 0) return [];
  const ready: T[] = [];
  const rest: T[] = [];
  for (const row of leads) {
    if (isOutreachReadyLead(platform, row)) ready.push(row);
    else rest.push(row);
  }
  return [...ready, ...rest].slice(0, cap);
}
