import "server-only";

import { OUTREACH_COWORK_EMAIL_BCC } from "@/lib/outreach-cowork";
import { withOutreachGraph } from "@/lib/outreach-graph";

/**
 * Outreach email send via Microsoft Graph, from the jb@match-fit.net mailbox.
 *
 * Server-side sendMail lands the message in the mailbox Sent folder automatically (Graph
 * `saveToSentItems: true`), satisfying the dispatch-brief requirement that outreach email must
 * go through jb@match-fit.net and be visible in Sent. Env-gated via `outreach-graph.ts`: when the
 * Graph app is not configured this returns `{ ok: false, skipped: true }` and NEVER throws, so a
 * dispatch/send request path degrades gracefully (the Cowork fallback handles the send instead).
 */

export type OutreachEmailSendInput = {
  to: string;
  subject: string;
  body: string;
  /** Extra BCC recipients; the locked Cowork BCC trio is always included. */
  bcc?: string[];
  /** Send as HTML instead of plain text. */
  html?: boolean;
};

export type OutreachEmailSendResult =
  | { ok: true; skipped: false }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; reason: string };

export async function sendOutreachEmail(input: OutreachEmailSendInput): Promise<OutreachEmailSendResult> {
  const to = input.to.trim();
  if (!to) return { ok: false, skipped: false, reason: "Missing recipient." };

  const bcc = [...new Set([...OUTREACH_COWORK_EMAIL_BCC, ...(input.bcc ?? [])])]
    .map((a) => a.trim())
    .filter(Boolean)
    .filter((a) => a.toLowerCase() !== to.toLowerCase());

  const result = await withOutreachGraph(async ({ token, mailbox, graphBase }) => {
    const message = {
      subject: input.subject,
      body: { contentType: input.html ? "HTML" : "Text", content: input.body },
      toRecipients: [{ emailAddress: { address: to } }],
      bccRecipients: bcc.map((address) => ({ emailAddress: { address } })),
    };
    const res = await fetch(`${graphBase}/users/${encodeURIComponent(mailbox)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message, saveToSentItems: true }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Graph sendMail failed (${res.status}): ${detail.slice(0, 300)}`);
    }
  });

  if (!result.configured) {
    return { ok: false, skipped: true, reason: "Microsoft Graph mailbox is not configured." };
  }
  return { ok: true, skipped: false };
}
