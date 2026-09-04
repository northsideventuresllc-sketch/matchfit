import { formatUserFacingError, readJsonResponse } from "@/lib/read-json-response";
import type { OutreachPlatform } from "@/lib/outreach-types";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function postJson<T>(
  url: string,
  body: unknown,
  fallback: string,
  method: "POST" | "PATCH" | "DELETE" = "POST",
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await readJsonResponse<T & { error?: string }>(res);
    if (!res.ok) return { ok: false, error: formatUserFacingError(data.error, fallback) };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: formatUserFacingError(e, fallback) };
  }
}

/** Edit + save a lead (the "rewrite" action). */
export function patchLead(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<{ lead?: unknown }>> {
  return postJson(`/api/admin/outreach/leads/${id}`, body, "Could not save lead.", "PATCH");
}

/**
 * Delete a hub-saved lead. NOTE: the spec named `bulk-delete` with `mode:"ids"`, but that route's
 * where-clause only matches pre-hub generation leads (`savedToHubAt: null`) so it cannot delete a
 * lane lead. `DELETE /leads/[id]` is the authoritative path for hub-saved leads — it archives them
 * (moving the row into the Archives tab) and enforces the same `deleteReason` (min 3 chars).
 */
export function deleteLead(
  id: string,
  platform: OutreachPlatform,
  deleteReason: string,
): Promise<ApiResult<{ ok: true; archived: boolean }>> {
  return postJson(
    `/api/admin/outreach/leads/${id}`,
    { platform, deleteReason },
    "Could not delete lead.",
    "DELETE",
  );
}

export type QueueDispatchResult = {
  batchId: string;
  slot: string | null;
  scheduledFor: string;
  queued: string[];
  skipped: string[];
};

/** Approve → queue the given leads into the next 1pm/4pm dispatch batch. */
export function queueDispatch(
  leadIds: { id: string; platform: OutreachPlatform }[],
): Promise<ApiResult<QueueDispatchResult>> {
  return postJson("/api/admin/outreach/dispatch/queue", { leadIds }, "Could not queue dispatch.");
}

/** Pull leads back out of their dispatch batch (restores previous lane). */
export function pullDispatch(
  leadIds: string[],
): Promise<ApiResult<{ pulled: string[]; skipped: string[] }>> {
  return postJson("/api/admin/outreach/dispatch/pull", { leadIds }, "Could not pull leads from dispatch.");
}

/** Manual Send — queues the given leads into the Send Queue tab's Manual section (no Cowork batch). */
export function sendManual(
  leadIds: { id: string; platform: OutreachPlatform }[],
): Promise<ApiResult<{ queued: string[]; skipped: string[] }>> {
  return postJson("/api/admin/outreach/send/manual", { leadIds }, "Could not queue manual send.");
}

/** Cancel an Agent Send — pulls a lead out of its Cowork batch and flips it to Manual (stays queued). */
export function cancelAgentSendToManual(
  leadIds: string[],
): Promise<ApiResult<{ converted: string[]; skipped: string[] }>> {
  return postJson(
    "/api/admin/outreach/send/cancel-to-manual",
    { leadIds },
    "Could not cancel agent send.",
  );
}

/** Send Queue "Manual" sent/not-sent toggle. */
export function setManualSent(
  id: string,
  platform: OutreachPlatform,
  sent: boolean,
): Promise<ApiResult<{ ok: true }>> {
  return postJson(
    "/api/admin/outreach/send/manual-sent",
    { id, platform, sent },
    "Could not update send status.",
    "PATCH",
  );
}

export type ScanResult = {
  email: { configured: boolean; matched: number; matches: unknown[] };
  instagram: { jobId: string; candidateCount: number };
};

/** Manual pending-response scan (email inline + Instagram Cowork job). */
export function scanPendingResponses(): Promise<ApiResult<ScanResult>> {
  return postJson("/api/admin/outreach/pending-responses/scan", {}, "Could not run pending-response scan.");
}

/** Autosave the edited reply draft in Pending Responses (no lane/status change). */
export function saveResponseDraft(
  id: string,
  platform: OutreachPlatform,
  pendingResponseDraft: string,
): Promise<ApiResult<{ ok: true }>> {
  return postJson(
    `/api/admin/outreach/leads/${id}/response-draft`,
    { platform, pendingResponseDraft },
    "Could not save reply.",
    "PATCH",
  );
}

/** Regenerate a pending-response draft for one lead. */
export function regenerateResponse(
  id: string,
  platform: OutreachPlatform,
  incomingMessage?: string,
): Promise<ApiResult<{ pendingResponseDraft: string }>> {
  return postJson(
    `/api/admin/outreach/leads/${id}/regenerate-response`,
    { platform, incomingMessage: incomingMessage?.trim() || undefined },
    "Could not regenerate response draft.",
  );
}

/** "Send another message" for a pending-lane lead — regenerates copy and queues to dispatch. */
export function sendAnother(
  id: string,
  platform: OutreachPlatform,
  feedback?: string,
): Promise<ApiResult<{ copy: unknown; dispatch: QueueDispatchResult }>> {
  return postJson(
    `/api/admin/outreach/leads/${id}/send-another`,
    { platform, feedback: feedback?.trim() || undefined },
    "Could not queue another message.",
  );
}

/** "Send To Follow Ups" — push a Pending Leads lead into the Send Queue now (follow-up override). */
export function sendToFollowUps(
  id: string,
  platform: OutreachPlatform,
): Promise<ApiResult<{ queued: string[]; skipped: string[] }>> {
  return postJson(
    "/api/admin/outreach/send/to-follow-ups",
    { id, platform },
    "Could not queue follow-up.",
  );
}

/** "Responded" — move a Pending Leads lead into Pending Responses. */
export function markResponded(
  id: string,
  platform: OutreachPlatform,
): Promise<ApiResult<{ ok: true }>> {
  return postJson(
    `/api/admin/outreach/leads/${id}/mark-responded`,
    { platform },
    "Could not mark lead as responded.",
  );
}

/** "Converted" — marks a lead as a real Match Fit signup, optionally linked to its account. */
export function markOutreachLeadConverted(
  id: string,
  platform: OutreachPlatform,
  account?: { type: "client" | "trainer"; id: string } | null,
): Promise<ApiResult<{ ok: true }>> {
  return postJson(
    `/api/admin/outreach/leads/${id}/convert`,
    {
      platform,
      matchedAccountType: account?.type ?? null,
      matchedAccountId: account?.id ?? null,
    },
    "Could not mark lead converted.",
  );
}

export type AdminAccountSearchResult = {
  accountType: "client" | "trainer";
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
};

/** Search real Match Fit accounts (client/trainer) by username or email — the account picker. */
export async function searchAdminAccounts(query: string): Promise<ApiResult<AdminAccountSearchResult[]>> {
  try {
    const res = await fetch(`/api/admin/support/account/search?q=${encodeURIComponent(query)}`, {
      credentials: "include",
    });
    const data = await readJsonResponse<{ results?: AdminAccountSearchResult[]; error?: string }>(res);
    if (!res.ok) return { ok: false, error: formatUserFacingError(data.error, "Could not search accounts.") };
    return { ok: true, data: data.results ?? [] };
  } catch (e) {
    return { ok: false, error: formatUserFacingError(e, "Could not search accounts.") };
  }
}

/** Regenerate outbound copy fields for a lead (rewrite assist). */
export function regenerateCopy(
  id: string,
  platform: OutreachPlatform,
  fields: string[],
  feedback?: string,
): Promise<ApiResult<{ copy?: Record<string, string> }>> {
  return postJson(
    `/api/admin/outreach/leads/${id}/generate-copy`,
    { platform, fields, feedback: feedback?.trim() || undefined },
    "Could not regenerate copy.",
  );
}
