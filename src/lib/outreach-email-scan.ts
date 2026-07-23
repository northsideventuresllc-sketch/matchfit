import "server-only";

import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { fireOutreachAxonEvent, type OutreachAxonLeadRef } from "@/lib/outreach-axon-notify";
import { withOutreachGraph } from "@/lib/outreach-graph";
import { generateOutreachResponseDraft } from "@/lib/outreach-response-draft";
import { prisma } from "@/lib/prisma";

const MS_DAY = 86_400_000;

type GraphMessage = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  from?: { emailAddress?: { address?: string } };
};

export type OutreachEmailScanMatch = {
  leadId: string;
  name: string;
  email: string;
  preview: string;
};

/**
 * Scans the jb@match-fit.net mailbox (Microsoft Graph, app-only) for replies from email leads we
 * already contacted. Env-gated: returns `{ configured: false }` with a log line when the Graph app
 * is not set up. On a new match: flags `hasUnrespondedReply`, moves the lead to the
 * `pending_response` lane, drafts an AI reply, and fires an AXON `pending_response` event.
 */
export async function scanOutreachEmailReplies(args: {
  adminId: string;
  now?: Date;
  lookbackDays?: number;
}): Promise<{ configured: boolean; matched: OutreachEmailScanMatch[] }> {
  await ensureOutreachHubSchema();
  const now = args.now ?? new Date();
  const lookbackDays = args.lookbackDays ?? 14;

  const outcome = await withOutreachGraph(async ({ token, mailbox, graphBase }) => {
    const sinceIso = new Date(now.getTime() - lookbackDays * MS_DAY).toISOString();
    const url =
      `${graphBase}/users/${encodeURIComponent(mailbox)}/messages` +
      `?$filter=${encodeURIComponent(`receivedDateTime ge ${sinceIso}`)}` +
      `&$select=id,from,subject,receivedDateTime,bodyPreview&$top=50&$orderby=receivedDateTime desc`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`[outreach-email-scan] Graph messages query failed (${res.status}).`);
      return [] as GraphMessage[];
    }
    const json = (await res.json()) as { value?: GraphMessage[] };
    return json.value ?? [];
  });

  if (!outcome.configured) return { configured: false, matched: [] };

  const matched: OutreachEmailScanMatch[] = [];
  const notifyLeads: OutreachAxonLeadRef[] = [];

  for (const msg of outcome.value) {
    const sender = msg.from?.emailAddress?.address?.trim().toLowerCase();
    if (!sender) continue;

    const lead = await prisma.outreachEmailLead.findFirst({
      where: {
        email: { equals: sender, mode: "insensitive" },
        deletedAt: null,
        archivedAt: null,
        hasUnrespondedReply: false,
        outreachSentAt: { not: null },
      },
    });
    if (!lead) continue;

    const receivedAt = msg.receivedDateTime ? new Date(msg.receivedDateTime) : now;
    await prisma.outreachEmailLead.update({
      where: { id: lead.id },
      data: {
        hasUnrespondedReply: true,
        replyReceivedAt: receivedAt,
        responseReceivedAt: lead.responseReceivedAt ?? receivedAt,
        status: "RESPONSE_RECEIVED",
        outreachLane: "pending_response",
      },
    });

    await generateOutreachResponseDraft({
      platform: "email",
      leadId: lead.id,
      adminId: args.adminId,
      incomingMessage: msg.bodyPreview,
    }).catch((e) => console.warn("[outreach-email-scan] draft generation failed", e));

    const preview = (msg.bodyPreview ?? "").slice(0, 200);
    matched.push({ leadId: lead.id, name: lead.name, email: lead.email, preview });
    notifyLeads.push({
      platform: "email",
      leadId: lead.id,
      handle: lead.name,
      contact: lead.email,
      summary: preview || "New email reply",
    });
  }

  if (notifyLeads.length > 0) {
    await fireOutreachAxonEvent({ eventType: "pending_response", leads: notifyLeads });
  }

  return { configured: true, matched };
}
