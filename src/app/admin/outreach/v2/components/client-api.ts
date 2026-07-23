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

export type ScanResult = {
  email: { configured: boolean; matched: number; matches: unknown[] };
  instagram: { jobId: string; candidateCount: number };
};

/** Manual pending-response scan (email inline + Instagram Cowork job). */
export function scanPendingResponses(): Promise<ApiResult<ScanResult>> {
  return postJson("/api/admin/outreach/pending-responses/scan", {}, "Could not run pending-response scan.");
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
