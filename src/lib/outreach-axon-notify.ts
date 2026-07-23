import "server-only";

import type { OutreachPlatform } from "@/lib/outreach-types";

/**
 * AXON outreach-event push hook (Telegram bridge).
 *
 * Fire-and-forget POST to the AXON outreach-event receiver, mirroring
 * `content-calendar/axon-notify.ts`: same shared-secret header
 * (`X-Match-Fit-Webhook-Secret` from `MATCH_FIT_WEBHOOK_SECRET`) but a DIFFERENT endpoint,
 * configured via `AXON_OUTREACH_EVENT_WEBHOOK_URL` (never hardcoded). When the URL is unset the
 * call is a no-op so no outreach flow ever fails on a missing integration.
 *
 * Contract is fixed and shared with the AXON-side receiver agent:
 *   { eventType, leads: [{ platform, leadId, handle, contact, summary?, dmText?, commentText? }], meta? }
 * — `eventType` is one of "new_leads" | "follow_up_due" | "pending_response".
 *
 * `dmText` / `commentText` are optional enrichment fields (populated for `new_leads`
 * Instagram entries) so AXON can render the outreach copy directly in the Telegram
 * message without a follow-up GET to /api/admin/outreach/leads/[id]. Additive and
 * backward compatible — older receivers ignore the extra keys.
 */

export type OutreachAxonEventType = "new_leads" | "follow_up_due" | "pending_response";

export type OutreachAxonLeadRef = {
  platform: OutreachPlatform;
  leadId: string;
  /** Display handle / page name / contact name — whichever fits the platform. */
  handle: string;
  /** Profile URL / page URL / email address. */
  contact: string;
  /** Optional one-line context (e.g. reply preview, follow-up stage). */
  summary?: string;
  /** Optional outreach copy (Instagram new_leads): the first DM text. */
  dmText?: string;
  /** Optional outreach copy (Instagram new_leads): the comment text. */
  commentText?: string;
};

export type OutreachAxonEventPayload = {
  eventType: OutreachAxonEventType;
  leads: OutreachAxonLeadRef[];
  /** Free-form extra context, e.g. { followUpStage: "follow_up_1" } or { slot: "13:00" }. */
  meta?: Record<string, unknown>;
};

export async function fireOutreachAxonEvent(payload: OutreachAxonEventPayload): Promise<void> {
  const url = process.env.AXON_OUTREACH_EVENT_WEBHOOK_URL?.trim();
  if (!url) return;
  if (payload.leads.length === 0) return;

  const body: OutreachAxonEventPayload = {
    eventType: payload.eventType,
    leads: payload.leads.map((l) => ({
      platform: l.platform,
      leadId: l.leadId,
      handle: l.handle,
      contact: l.contact,
      ...(l.summary ? { summary: l.summary } : {}),
      ...(l.dmText ? { dmText: l.dmText } : {}),
      ...(l.commentText ? { commentText: l.commentText } : {}),
    })),
    ...(payload.meta ? { meta: payload.meta } : {}),
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = process.env.MATCH_FIT_WEBHOOK_SECRET?.trim();
  if (secret) headers["X-Match-Fit-Webhook-Secret"] = secret;

  try {
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    console.warn("[outreach-axon-notify] event webhook failed", e);
  }
}
