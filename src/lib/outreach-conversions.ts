import "server-only";

import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { serializeEmailLead, serializeFacebookLead, serializeInstagramLead } from "@/lib/outreach-data";
import type {
  EmailLeadRow,
  FacebookLeadRow,
  InstagramLeadRow,
  OutreachConversionLead,
  OutreachPlatform,
  OutreachTouchLogEntry,
  OutreachTouchStage,
} from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";
import { scopedToMatchFit } from "@/lib/outreach-venture-scope";

async function getLeadRow(platform: OutreachPlatform, id: string) {
  if (platform === "instagram") return prisma.outreachInstagramLead.findUnique({ where: { id } });
  if (platform === "facebook") return prisma.outreachFacebookLead.findUnique({ where: { id } });
  return prisma.outreachEmailLead.findUnique({ where: { id } });
}

async function setLeadRow(platform: OutreachPlatform, id: string, data: Record<string, unknown>) {
  if (platform === "instagram") return prisma.outreachInstagramLead.update({ where: { id }, data });
  if (platform === "facebook") return prisma.outreachFacebookLead.update({ where: { id }, data });
  return prisma.outreachEmailLead.update({ where: { id }, data });
}

function messageFieldsForBackfillStage(
  platform: OutreachPlatform,
  stage: OutreachTouchStage,
  lead: Record<string, unknown>,
): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [];
  const str = (key: string): string | undefined =>
    typeof lead[key] === "string" && lead[key] ? (lead[key] as string) : undefined;

  if (platform === "instagram") {
    if (stage === "follow_up_1") {
      const t = str("followUp1DmText");
      if (t) out.push({ label: "First follow-up DM", text: t });
    } else if (stage === "follow_up_2") {
      const t = str("followUp2DmText");
      if (t) out.push({ label: "Second follow-up DM", text: t });
    } else {
      const dm = str("dmText");
      const comment = str("commentText");
      if (dm) out.push({ label: "First DM", text: dm });
      if (comment) out.push({ label: "Comment", text: comment });
    }
  } else if (platform === "facebook") {
    const post = str("pagePostText");
    if (post) out.push({ label: "Page post", text: post });
  } else {
    if (stage === "follow_up_1") {
      const subject = str("followUp1EmailSubject");
      const body = str("followUp1EmailBody");
      if (subject) out.push({ label: "First follow-up subject", text: subject });
      if (body) out.push({ label: "First follow-up email", text: body });
    } else if (stage === "follow_up_2") {
      const subject = str("followUp2EmailSubject");
      const body = str("followUp2EmailBody");
      if (subject) out.push({ label: "Second follow-up subject", text: subject });
      if (body) out.push({ label: "Second follow-up email", text: body });
    } else {
      const subject = str("emailSubject");
      const body = str("emailBody");
      if (subject) out.push({ label: "Subject", text: subject });
      if (body) out.push({ label: "Body", text: body });
    }
  }
  return out;
}

/**
 * One-time, lazy, per-lead reconstruction for leads that have send timestamps predating
 * `outreach_lead_touch_log` (i.e. everyone in the pipeline before this feature shipped). Runs only
 * at the moment a specific lead is converted — never a bulk job. Each reconstructed row is tagged
 * `reconstructed: true` and `sendMode: "unknown"` — by the time a lead converts, the mutable
 * `sendMode` column on the lead row has already been cleared by a later touch (or was never
 * meaningful for a stage this old), so guessing manual/agent would be fabricating a fact this repo's
 * anti-lying rules forbid. If a lead has zero send timestamps, nothing is fabricated — the touch
 * list for that lead is just empty.
 */
async function backfillTouchHistoryForLead(
  platform: OutreachPlatform,
  leadId: string,
  lead: Record<string, unknown>,
): Promise<void> {
  const existing = await prisma.outreachLeadTouchLog.findMany({
    where: { platform, leadId },
    select: { stage: true },
  });
  const alreadyLogged = new Set(existing.map((e) => e.stage));

  const candidates: { stage: OutreachTouchStage; sentAt: unknown }[] = [
    { stage: "initial", sentAt: lead.outreachSentAt },
    { stage: "follow_up_1", sentAt: lead.followUp1SentAt },
    { stage: "follow_up_2", sentAt: lead.followUp2SentAt },
  ];

  for (const c of candidates) {
    if (alreadyLogged.has(c.stage)) continue;
    if (!(c.sentAt instanceof Date)) continue;
    const messageFields = messageFieldsForBackfillStage(platform, c.stage, lead);
    if (messageFields.length === 0) continue;
    await prisma.outreachLeadTouchLog.create({
      data: {
        platform,
        leadId,
        stage: c.stage,
        sentAt: c.sentAt,
        sendMode: "unknown",
        messageFields: messageFields as unknown as Parameters<
          typeof prisma.outreachLeadTouchLog.create
        >[0]["data"]["messageFields"],
        reconstructed: true,
      },
    });
  }
}

/**
 * Marks a lead converted (idempotent — a second call never re-stamps `convertedAt`, it only
 * updates the account-link fields) and triggers the lazy touch-history backfill on first
 * conversion. Linking a Match Fit account is optional and can be added/changed later via the same
 * function — Converted never blocks on finding a match.
 */
export async function setOutreachLeadConversion(args: {
  platform: OutreachPlatform;
  id: string;
  adminId: string;
  matchedAccountType?: "client" | "trainer" | null;
  matchedAccountId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureOutreachHubSchema();
  const existing = await getLeadRow(args.platform, args.id);
  if (!existing) return { ok: false, error: "Lead not found." };

  const isFirstConversion = !(existing as { convertedAt: Date | null }).convertedAt;
  const data: Record<string, unknown> = {};
  if (args.matchedAccountType !== undefined) data.matchedAccountType = args.matchedAccountType;
  if (args.matchedAccountId !== undefined) data.matchedAccountId = args.matchedAccountId;
  if (isFirstConversion) {
    data.convertedAt = new Date();
    data.convertedByAdminId = args.adminId;
    data.outreachLane = "converted";
  }

  await setLeadRow(args.platform, args.id, data);
  if (isFirstConversion) {
    await backfillTouchHistoryForLead(args.platform, args.id, existing as unknown as Record<string, unknown>);
  }
  return { ok: true };
}

function toTouchEntry(row: {
  id: string;
  stage: string;
  sentAt: Date;
  sendMode: string;
  messageFields: unknown;
  dispatchBatchId: string | null;
  performedByAdminId: string | null;
  reconstructed: boolean;
}): OutreachTouchLogEntry {
  const fields = Array.isArray(row.messageFields)
    ? (row.messageFields as { label: string; text: string }[])
    : [];
  return {
    id: row.id,
    stage: row.stage,
    sentAt: row.sentAt.toISOString(),
    sendMode: row.sendMode,
    messageFields: fields,
    dispatchBatchId: row.dispatchBatchId,
    performedByAdminId: row.performedByAdminId,
    reconstructed: row.reconstructed,
  };
}

/**
 * All converted leads for the Successful Conversions tab, each with its full touch history —
 * mirrors `listOutreachArchiveLeads()` in outreach-data.ts (parallel findMany x3, combine, sort),
 * plus one grouped `findMany` on the touch log per platform result set (no N+1).
 */
export async function listOutreachConvertedLeads(): Promise<OutreachConversionLead[]> {
  await ensureOutreachHubSchema();
  const convertedWhere = scopedToMatchFit({
    deletedAt: null,
    convertedAt: { not: null } as const,
  });

  const [instagram, facebook, email] = await Promise.all([
    prisma.outreachInstagramLead.findMany({ where: convertedWhere, orderBy: { convertedAt: "desc" } }),
    prisma.outreachFacebookLead.findMany({ where: convertedWhere, orderBy: { convertedAt: "desc" } }),
    prisma.outreachEmailLead.findMany({ where: convertedWhere, orderBy: { convertedAt: "desc" } }),
  ]);

  const allIds = [...instagram, ...facebook, ...email].map((r) => r.id);
  const touchRows = allIds.length
    ? await prisma.outreachLeadTouchLog.findMany({
        where: { leadId: { in: allIds } },
        orderBy: { sentAt: "asc" },
      })
    : [];
  const touchesByLeadId = new Map<string, OutreachTouchLogEntry[]>();
  for (const row of touchRows) {
    const list = touchesByLeadId.get(row.leadId) ?? [];
    list.push(toTouchEntry(row));
    touchesByLeadId.set(row.leadId, list);
  }

  const combined: OutreachConversionLead[] = [
    ...instagram.map((r) => ({
      platform: "instagram" as const,
      convertedAt: r.convertedAt!.toISOString(),
      convertedByAdminId: r.convertedByAdminId,
      matchedAccountType: r.matchedAccountType,
      matchedAccountId: r.matchedAccountId,
      lead: serializeInstagramLead(r) as InstagramLeadRow,
      touches: touchesByLeadId.get(r.id) ?? [],
    })),
    ...facebook.map((r) => ({
      platform: "facebook" as const,
      convertedAt: r.convertedAt!.toISOString(),
      convertedByAdminId: r.convertedByAdminId,
      matchedAccountType: r.matchedAccountType,
      matchedAccountId: r.matchedAccountId,
      lead: serializeFacebookLead(r) as FacebookLeadRow,
      touches: touchesByLeadId.get(r.id) ?? [],
    })),
    ...email.map((r) => ({
      platform: "email" as const,
      convertedAt: r.convertedAt!.toISOString(),
      convertedByAdminId: r.convertedByAdminId,
      matchedAccountType: r.matchedAccountType,
      matchedAccountId: r.matchedAccountId,
      lead: serializeEmailLead(r) as EmailLeadRow,
      touches: touchesByLeadId.get(r.id) ?? [],
    })),
  ];

  return combined.sort((a, b) => new Date(b.convertedAt).getTime() - new Date(a.convertedAt).getTime());
}
