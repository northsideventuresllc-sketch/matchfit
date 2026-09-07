import "server-only";

import { NI_SERVICES_VENTURE_SLUG } from "@/lib/lead-taxonomy";
import { isEstWeekend } from "@/lib/outreach-lanes";
import type { OutreachPlatform } from "@/lib/outreach-types";

/**
 * BPA-B3-OUTREACH-SEND-0906 — per-venture send steps for the mini.
 *
 * Ticket: "outreach sending on the mini. Per-venture send steps (Instagram DM via
 * Chrome/desktop control; email via the right Resend account); approve-only; weekdays only;
 * JB's manual sends reported back."
 *
 * This module is routing + gating scaffolding only — it decides WHICH executor a send goes
 * through and WHETHER a send is allowed to happen right now. It does not itself send anything:
 * - Email actually goes out via `sendResendEmail` (src/lib/resend-client.ts) once wired to the
 *   account this module resolves.
 * - Instagram DMs are queued as a job for JB's Mac mini (see `queueInstagramSendStep` below) —
 *   never sent directly from this server.
 */

// ---------------------------------------------------------------------------------------------
// Routing — per-venture send steps
// ---------------------------------------------------------------------------------------------

export type SendChannel = OutreachPlatform;
export type SendExecutor = "resend" | "mini_chrome";
export type SendAccount = "match_fit" | "ni";

export type PlannedSendStep = {
  channel: SendChannel;
  executor: SendExecutor;
  /** Which Resend account (or NI vs Match Fit routing generally) this send belongs to. */
  account: SendAccount;
};

/**
 * Decides how a lead's send goes out, given the lead's platform and the venture it belongs to.
 *
 * - email -> Resend, using the account that matches the venture (two-account rule).
 * - instagram / facebook -> the mini's browser (Chrome/desktop control) — never a direct API
 *   send, matching the existing Cowork dispatch brief (`outreach-dispatch.ts`), which already
 *   hands Instagram/Facebook actions to a browser-driven agent on JB's own machine rather than
 *   calling any DM/post API.
 *
 * `ventureSlug` mirrors the existing "unassigned/null reads as Match Fit" convention already
 * used by `outreach-venture-scope.ts` (`matchFitLaneScope`) — a lead with no venture stamped is
 * a Match Fit lead, the only venture this app generates leads for on its own.
 */
export function planSendStep(
  lead: { platform: SendChannel },
  ventureSlug?: string | null,
): PlannedSendStep {
  const channel = lead.platform;
  const executor: SendExecutor = channel === "email" ? "resend" : "mini_chrome";
  const account: SendAccount = ventureSlug === NI_SERVICES_VENTURE_SLUG ? "ni" : "match_fit";
  return { channel, executor, account };
}

/** Which env var carries the Resend API key for a given account (the two-account rule). */
export function resendAccountEnvKey(account: SendAccount): "RESEND_API_KEY" | "RESEND_API_KEY_NI" {
  return account === "ni" ? "RESEND_API_KEY_NI" : "RESEND_API_KEY";
}

/** From address for a given Resend account, matching the venture the send belongs to. */
export function resendAccountFromAddress(account: SendAccount): string {
  return account === "ni" ? "jb@northsideintelligence.com" : "jb@match-fit.net";
}

// ---------------------------------------------------------------------------------------------
// Gate — approve-only, weekday-only, no fabricated recipients
// ---------------------------------------------------------------------------------------------

export type SendAllowedLead = {
  /** Outreach HQ lane the lead is currently in. A send is only allowed from `dispatch_queued` —
   *  the lane a lead only reaches once an admin has explicitly queued it (queueOutreachDispatch /
   *  queueManualSend), i.e. approved it. This IS the approval marker; there is no separate
   *  boolean column for it in the schema. */
  outreachLane: string | null;
  /** Recipient address/handle this send would go to, when known. Required only for the
   *  test-recipient-allowlist check below. */
  recipient?: string | null;
};

export type SendAllowedResult = { allowed: true } | { allowed: false; reason: string };

/** Comma-separated allowlist of recipients a TEST run may send/target — JB's own accounts. */
function testRecipientAllowlist(): string[] {
  return (process.env.OUTREACH_TEST_RECIPIENTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** True only inside an automated test run (vitest sets NODE_ENV=test). */
function isTestRun(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * The single gate every send path (agent completion, manual "mark sent", recorded manual send)
 * must pass before a send is treated as allowed:
 *   1. Approved — the lead is in the `dispatch_queued` lane (an admin queued it).
 *   2. Weekday-only — America/New_York, per the standing outreach rule (mirrors `isEstWeekend`,
 *      already used by the follow-up cron for the same reason).
 *   3. No fabricated recipients in a test run — a test send may only target an address/handle
 *      listed in `OUTREACH_TEST_RECIPIENTS` (JB's own accounts). Outside a test run this check
 *      does not apply — production recipients are real leads, not a fixed allowlist.
 */
export function assertSendAllowed(lead: SendAllowedLead, now: Date = new Date()): SendAllowedResult {
  if (lead.outreachLane !== "dispatch_queued") {
    return { allowed: false, reason: "Lead is not approved for send (not in the send queue)." };
  }
  if (isEstWeekend(now)) {
    return { allowed: false, reason: "Outreach only sends on weekdays (America/New_York)." };
  }
  // Recipient allowlist only applies when a caller actually supplies a recipient to check — a
  // caller with nothing to check against (e.g. a lane-only gate check) isn't asserting anything
  // about who the send targets, so there is nothing to block here.
  if (isTestRun() && lead.recipient !== undefined) {
    const recipient = lead.recipient?.trim().toLowerCase();
    const allowlist = testRecipientAllowlist();
    if (!recipient || !allowlist.includes(recipient)) {
      return {
        allowed: false,
        reason: "Test runs may only target a recipient listed in OUTREACH_TEST_RECIPIENTS.",
      };
    }
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------------------------
// Instagram — queue for the mini instead of sending
// ---------------------------------------------------------------------------------------------

/**
 * Instagram DMs are never sent from this server — Instagram has no send API this app is allowed
 * to call. Per the ticket, an Instagram send step queues a job for JB's Mac mini (Chrome/desktop
 * control) instead. This reuses the same NI-Brain `nvg_mini_jobs` job queue Content Calendar
 * already drives real Mac-mini browser work through (`queueMiniChromeAgentJob`,
 * src/lib/content-calendar/cowork-jobs.ts:84) — same mechanism, so the mini's existing job-queue
 * runner (see that file's docstring) is what eventually claims and runs it.
 *
 * NOTE: `queueMiniChromeAgentJob`'s queued shell command is currently hardcoded to the Gemini
 * media-generation script (cowork-jobs.ts:92-93) — it is not yet wired to run an Instagram-DM
 * automation script. Building that script is out of scope for this ticket (no sends of any
 * kind); this function only establishes that Instagram routes to the mini's job queue rather
 * than to any direct send call, so a later ticket can point the queued job at the right script
 * without touching this routing decision.
 */
export async function queueInstagramSendStep(lead: { id: string; handle?: string | null }): Promise<void> {
  const { queueMiniChromeAgentJob } = await import("@/lib/content-calendar/cowork-jobs");
  await queueMiniChromeAgentJob({
    ids: [lead.id],
    title: `Outreach Instagram DM — ${lead.handle ?? lead.id}`,
  });
}

// ---------------------------------------------------------------------------------------------
// Manual sends — JB's manual sends reported back
// ---------------------------------------------------------------------------------------------

/**
 * Records a send JB performed manually (outside this app — e.g. he sent the DM or email
 * himself), writing the SAME fields the automated dispatch-completion path writes:
 * `setManualSentState` (outreach-dispatch.ts) already does exactly this — lane advance +
 * `outreach_lead_touch_log` row via `recordOutreachTouch` — so this is a thin, ticket-named
 * wrapper over that existing function rather than a second implementation, plus an optional
 * `note` folded into the touch-log's `messageFields` so JB's own note about the manual send is
 * preserved alongside what was sent.
 */
export async function recordManualSend(
  leadId: string,
  channel: OutreachPlatform,
  sentAt: Date,
  note?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { setManualSentState } = await import("@/lib/outreach-dispatch");
  return setManualSentState({ id: leadId, platform: channel, sent: true, now: sentAt, note });
}
