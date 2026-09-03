import type {
  EmailLeadRow,
  FacebookLeadRow,
  InstagramLeadRow,
  OutreachArchiveLead,
  OutreachHubLead,
  OutreachLane,
  OutreachPlatform,
} from "@/lib/outreach-types";

/** The eight Outreach HQ v2 tabs (Outreach Hub is a zoom-out view, not a lane). */
export type OutreachV2Tab =
  | "today"
  | "past_due"
  | "follow_ups"
  | "pending_responses"
  | "hub"
  | "dispatch"
  | "pending"
  | "archives";

/** Platform filter used on the lead-list tabs. `both` = every platform (nothing hidden). */
export type LeadPlatformFilter = "instagram" | "email" | "both";

export const LEAD_PLATFORM_FILTERS: { id: LeadPlatformFilter; label: string }[] = [
  { id: "both", label: "Both" },
  { id: "instagram", label: "Instagram" },
  { id: "email", label: "Email" },
];

/** The follow-up stage sub-filter. */
export type FollowUpStageFilter = "all" | "follow_up_1" | "follow_up_2";

export const FOLLOW_UP_STAGE_FILTERS: { id: FollowUpStageFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "follow_up_1", label: "1st follow-up" },
  { id: "follow_up_2", label: "2nd follow-up" },
];

export function laneOf(entry: OutreachHubLead): OutreachLane {
  return (entry.lead.outreachLane as OutreachLane) ?? "pending";
}

export function leadDisplayName(entry: {
  platform: OutreachPlatform;
  lead: InstagramLeadRow | FacebookLeadRow | EmailLeadRow;
}): string {
  if (entry.platform === "instagram") return (entry.lead as InstagramLeadRow).handle;
  if (entry.platform === "facebook") return (entry.lead as FacebookLeadRow).pageName;
  return (entry.lead as EmailLeadRow).name;
}

export function leadContactUrl(entry: {
  platform: OutreachPlatform;
  lead: InstagramLeadRow | FacebookLeadRow | EmailLeadRow;
}): string | null {
  if (entry.platform === "instagram") return (entry.lead as InstagramLeadRow).profileUrl;
  if (entry.platform === "facebook") return (entry.lead as FacebookLeadRow).pageUrl;
  return (entry.lead as EmailLeadRow).emailSourceUrl;
}

/** Group hub-saved leads by their current lane. Archived leads never appear in the hub list. */
export function groupHubLeadsByLane(
  entries: OutreachHubLead[],
): Record<OutreachLane, OutreachHubLead[]> {
  const grouped: Record<OutreachLane, OutreachHubLead[]> = {
    today: [],
    past_due: [],
    follow_up_1: [],
    follow_up_2: [],
    pending_response: [],
    dispatch_queued: [],
    pending: [],
    archived: [],
  };
  for (const entry of entries) {
    const lane = laneOf(entry);
    if (grouped[lane]) grouped[lane].push(entry);
  }
  return grouped;
}

/** `both` includes every platform (Facebook page leads are only surfaced under `both`). */
export function filterLeadsByPlatform(
  entries: OutreachHubLead[],
  filter: LeadPlatformFilter,
): OutreachHubLead[] {
  if (filter === "both") return entries;
  return entries.filter((e) => e.platform === filter);
}

/** Combined follow-up lanes, optionally narrowed to one stage. */
export function selectFollowUpLeads(
  grouped: Record<OutreachLane, OutreachHubLead[]>,
  stage: FollowUpStageFilter,
): OutreachHubLead[] {
  if (stage === "follow_up_1") return grouped.follow_up_1;
  if (stage === "follow_up_2") return grouped.follow_up_2;
  return [...grouped.follow_up_1, ...grouped.follow_up_2];
}

/** The due timestamp that governs the current follow-up lane for a lead. */
export function followUpDueAt(entry: OutreachHubLead): string | null {
  const lane = laneOf(entry);
  const lead = entry.lead as InstagramLeadRow | EmailLeadRow;
  if (lane === "follow_up_1") return lead.followUp1DueAt ?? null;
  if (lane === "follow_up_2") return lead.followUp2DueAt ?? null;
  return null;
}

export type OverdueInfo = { state: "overdue" | "due_soon" | "scheduled" | "none"; label: string };

function humanizeDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** How overdue (or how soon due) a follow-up is, relative to `nowMs`. */
export function formatOverdue(dueAtIso: string | null, nowMs: number = Date.now()): OverdueInfo {
  if (!dueAtIso) return { state: "none", label: "No due time set" };
  const due = new Date(dueAtIso).getTime();
  if (Number.isNaN(due)) return { state: "none", label: "No due time set" };
  const diff = nowMs - due;
  if (diff > 0) return { state: "overdue", label: `Overdue by ${humanizeDuration(diff)}` };
  return { state: "scheduled", label: `Due in ${humanizeDuration(-diff)}` };
}

/**
 * Archive origin. There is no explicit `archiveType` column on outreach leads, so we infer it:
 * a manual admin delete stamps `deadLeadAt` and `archivedAt` in the same operation (identical
 * instants), whereas the dead-lead auto-archive cron sets `archivedAt` at least 48h after the
 * earlier `deadLeadAt`. A small tolerance absorbs write latency between the two updates.
 */
export function archiveOrigin(entry: OutreachArchiveLead): "manual" | "dead_lead" {
  if (!entry.deadLeadAt || !entry.archivedAt) return "dead_lead";
  const dead = new Date(entry.deadLeadAt).getTime();
  const archived = new Date(entry.archivedAt).getTime();
  if (Number.isNaN(dead) || Number.isNaN(archived)) return "dead_lead";
  return Math.abs(archived - dead) <= 5000 ? "manual" : "dead_lead";
}

export type LaneTile = {
  tab: OutreachV2Tab;
  lane: OutreachLane | null;
  label: string;
  count: number;
};

/**
 * Per-lane counts for the Outreach Hub zoom-out view. The stats endpoint does not break down by
 * lane, so counts are aggregated client-side from the already-fetched hub list plus the archive
 * list. Dispatch count is the `dispatch_queued` lane size (authoritative live batch membership).
 */
export function computeLaneTiles(
  grouped: Record<OutreachLane, OutreachHubLead[]>,
  archiveCount: number,
): LaneTile[] {
  return [
    { tab: "today", lane: "today", label: "Today's leads", count: grouped.today.length },
    { tab: "past_due", lane: "past_due", label: "Past due", count: grouped.past_due.length },
    { tab: "follow_ups", lane: "follow_up_1", label: "Follow-up 1", count: grouped.follow_up_1.length },
    { tab: "follow_ups", lane: "follow_up_2", label: "Follow-up 2", count: grouped.follow_up_2.length },
    {
      tab: "pending_responses",
      lane: "pending_response",
      label: "Pending responses",
      count: grouped.pending_response.length,
    },
    { tab: "dispatch", lane: "dispatch_queued", label: "Dispatch", count: grouped.dispatch_queued.length },
    { tab: "pending", lane: "pending", label: "Pending", count: grouped.pending.length },
    { tab: "archives", lane: "archived", label: "Archives", count: archiveCount },
  ];
}

/** Build-time lead snapshot carried inside a dispatch batch brief. */
export type DispatchBriefLead = {
  leadId: string;
  platform: OutreachPlatform;
  displayName: string;
  contact: string;
  outreachIntent: string | null;
  /** Instagram only — undefined for other platforms. */
  dmText?: string;
  commentText?: string;
  commentPostRef?: string;
  /** Facebook only. */
  pagePostText?: string;
  /** Email only. */
  emailSubject?: string;
  emailBody?: string;
};

function optionalString(rec: Record<string, unknown>, key: string): string | undefined {
  return typeof rec[key] === "string" ? (rec[key] as string) : undefined;
}

/** Safely read the `brief.leads[]` snapshot off a dispatch batch (best-effort, tolerant of shape). */
export function dispatchBriefLeads(brief: Record<string, unknown> | null | undefined): DispatchBriefLead[] {
  const raw = brief && typeof brief === "object" ? (brief as { leads?: unknown }).leads : null;
  if (!Array.isArray(raw)) return [];
  const out: DispatchBriefLead[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.leadId !== "string" || typeof rec.platform !== "string") continue;
    out.push({
      leadId: rec.leadId,
      platform: rec.platform as OutreachPlatform,
      displayName: typeof rec.displayName === "string" ? rec.displayName : rec.leadId,
      contact: typeof rec.contact === "string" ? rec.contact : "",
      outreachIntent: typeof rec.outreachIntent === "string" ? rec.outreachIntent : null,
      dmText: optionalString(rec, "dmText"),
      commentText: optionalString(rec, "commentText"),
      commentPostRef: optionalString(rec, "commentPostRef"),
      pagePostText: optionalString(rec, "pagePostText"),
      emailSubject: optionalString(rec, "emailSubject"),
      emailBody: optionalString(rec, "emailBody"),
    });
  }
  return out;
}

export type MessageField = { label: string; text: string };

/**
 * The actual message text queued for an Agent Send batch lead, straight off the brief snapshot
 * built by `buildBatchBrief()` — this is exactly what Cowork will send, so it's the right source
 * even though (pre-existing, separate gap) `buildBatchBrief` always embeds the primary-stage text
 * regardless of whether the lead was queued from a follow-up lane.
 */
export function briefLeadMessageFields(l: DispatchBriefLead): MessageField[] {
  const out: MessageField[] = [];
  if (l.platform === "instagram") {
    if (l.dmText) out.push({ label: "DM", text: l.dmText });
    if (l.commentText) out.push({ label: "Comment", text: l.commentText });
  } else if (l.platform === "facebook") {
    if (l.pagePostText) out.push({ label: "Page post", text: l.pagePostText });
  } else if (l.platform === "email") {
    if (l.emailSubject) out.push({ label: "Subject", text: l.emailSubject });
    if (l.emailBody) out.push({ label: "Body", text: l.emailBody });
  }
  return out;
}

/**
 * The message text for a Manual Send queue entry, stage-aware: `dispatchPreviousLane` records the
 * lane the lead was in the moment it was queued (today/past_due/pending = primary send,
 * follow_up_1/follow_up_2 = that follow-up's text). Facebook has no follow-up pipeline, so it's
 * always the page post text.
 */
export function manualQueueMessageFields(entry: OutreachHubLead): MessageField[] {
  const lead = entry.lead as InstagramLeadRow | FacebookLeadRow | EmailLeadRow;
  const stage = (lead as { dispatchPreviousLane?: string | null }).dispatchPreviousLane ?? null;
  const out: MessageField[] = [];

  if (entry.platform === "instagram") {
    const ig = lead as InstagramLeadRow;
    if (stage === "follow_up_1") {
      if (ig.followUp1DmText) out.push({ label: "First follow-up DM", text: ig.followUp1DmText });
    } else if (stage === "follow_up_2") {
      if (ig.followUp2DmText) out.push({ label: "Second follow-up DM", text: ig.followUp2DmText });
    } else {
      if (ig.dmText) out.push({ label: "First DM", text: ig.dmText });
      if (ig.commentText) out.push({ label: "Comment", text: ig.commentText });
    }
  } else if (entry.platform === "facebook") {
    const fb = lead as FacebookLeadRow;
    if (fb.pagePostText) out.push({ label: "Page post", text: fb.pagePostText });
  } else {
    const em = lead as EmailLeadRow;
    if (stage === "follow_up_1") {
      if (em.followUp1EmailSubject) out.push({ label: "First follow-up subject", text: em.followUp1EmailSubject });
      if (em.followUp1EmailBody) out.push({ label: "First follow-up email", text: em.followUp1EmailBody });
    } else if (stage === "follow_up_2") {
      if (em.followUp2EmailSubject) out.push({ label: "Second follow-up subject", text: em.followUp2EmailSubject });
      if (em.followUp2EmailBody) out.push({ label: "Second follow-up email", text: em.followUp2EmailBody });
    } else {
      if (em.emailSubject) out.push({ label: "Subject", text: em.emailSubject });
      if (em.emailBody) out.push({ label: "Body", text: em.emailBody });
    }
  }
  return out;
}

/**
 * Nav badge count per tab (the "needs attention" backlogs only — Today/Hub/Dispatch/Pending/Archives
 * don't get a red dot). Pending Responses only counts leads with an actual unread reply, matching
 * what that tab shows — not every `pending_response`-lane row.
 */
export function tabBadgeCount(tab: OutreachV2Tab, grouped: Record<OutreachLane, OutreachHubLead[]>): number {
  if (tab === "past_due") return grouped.past_due.length;
  if (tab === "follow_ups") return grouped.follow_up_1.length + grouped.follow_up_2.length;
  if (tab === "pending_responses") {
    return grouped.pending_response.filter((e) => e.lead.hasUnrespondedReply).length;
  }
  return 0;
}

/** Leads currently in the Send Queue's Manual section (queued, no Cowork batch). */
export function selectManualQueuedLeads(
  grouped: Record<OutreachLane, OutreachHubLead[]>,
): OutreachHubLead[] {
  return grouped.dispatch_queued.filter((e) => e.lead.sendMode === "manual");
}

/** "Mon, Jul 28 · 1:00 PM ET" style label for a dispatch batch slot. */
export function formatDispatchSlot(scheduledForIso: string, slot: string | null): string {
  const d = new Date(scheduledForIso);
  if (Number.isNaN(d.getTime())) return slot ?? "Scheduled";
  const label = d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${label} ET`;
}
