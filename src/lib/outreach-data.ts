import "server-only";

import { classifyOutreachLead, facebookStatusTimestampsForUpdate, statusTimestampsForUpdate } from "@/lib/outreach-classification";
import type {
  EmailLeadRow,
  FacebookLeadRow,
  InstagramLeadRow,
  OutreachArchiveLead,
  OutreachHubLead,
  OutreachLeadStatus,
  OutreachPlatform,
} from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";
import { backfillOutreachHubLeads } from "@/lib/outreach-hub-backfill";
import { computeOutreachHubStats, type OutreachHubStats } from "@/lib/outreach-hub-stats";
import { scopedToMatchFit } from "@/lib/outreach-venture-scope";

let outreachSchemaReady: Promise<void> | null = null;

async function ensureOutreachReady(): Promise<void> {
  if (!outreachSchemaReady) {
    outreachSchemaReady = ensureOutreachHubSchema().catch((error) => {
      outreachSchemaReady = null;
      throw error;
    });
  }
  await outreachSchemaReady;
}

function serializeDate(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function serializeInstagramLead(
  r: Awaited<ReturnType<typeof prisma.outreachInstagramLead.findMany>>[number],
): InstagramLeadRow {
  const autoClassification = classifyOutreachLead({
    status: r.status,
    platform: "instagram",
    outreachSentAt: r.outreachSentAt,
    followUp1SentAt: r.followUp1SentAt,
    followUp2SentAt: r.followUp2SentAt,
    responseReceivedAt: r.responseReceivedAt,
    createdAt: r.createdAt,
  });
  return {
    ...r,
    autoClassification,
    followUp1DmText: r.followUp1DmText ?? "",
    followUp2DmText: r.followUp2DmText ?? "",
    createdAt: r.createdAt.toISOString(),
    deletedAt: serializeDate(r.deletedAt),
    savedToHubAt: serializeDate(r.savedToHubAt),
    deadLeadAt: serializeDate(r.deadLeadAt),
    archivedAt: serializeDate(r.archivedAt),
    archivePurgeAfterAt: serializeDate(r.archivePurgeAfterAt),
    outreachSentAt: serializeDate(r.outreachSentAt),
    followUp1SentAt: serializeDate(r.followUp1SentAt),
    followUp2SentAt: serializeDate(r.followUp2SentAt),
    responseReceivedAt: serializeDate(r.responseReceivedAt),
    queuedForDate: serializeDate(r.queuedForDate),
    followUp1DueAt: serializeDate(r.followUp1DueAt),
    followUp1LastRemindedAt: serializeDate(r.followUp1LastRemindedAt),
    followUp2DueAt: serializeDate(r.followUp2DueAt),
    followUp2LastRemindedAt: serializeDate(r.followUp2LastRemindedAt),
    archiveUiHiddenAfterAt: serializeDate(r.archiveUiHiddenAfterAt),
    replyReceivedAt: serializeDate(r.replyReceivedAt),
    pendingResponseDraftAt: serializeDate(r.pendingResponseDraftAt),
  };
}

function serializeFacebookLead(
  r: Awaited<ReturnType<typeof prisma.outreachFacebookLead.findMany>>[number],
): FacebookLeadRow {
  return {
    ...r,
    autoClassification: classifyOutreachLead({
      status: r.status,
      platform: "facebook",
      outreachSentAt: r.outreachSentAt,
      followUp1SentAt: null,
      followUp2SentAt: null,
      responseReceivedAt: r.responseReceivedAt,
      createdAt: r.createdAt,
    }),
    createdAt: r.createdAt.toISOString(),
    deletedAt: serializeDate(r.deletedAt),
    savedToHubAt: serializeDate(r.savedToHubAt),
    deadLeadAt: serializeDate(r.deadLeadAt),
    archivedAt: serializeDate(r.archivedAt),
    archivePurgeAfterAt: serializeDate(r.archivePurgeAfterAt),
    outreachSentAt: serializeDate(r.outreachSentAt),
    responseReceivedAt: serializeDate(r.responseReceivedAt),
    queuedForDate: serializeDate(r.queuedForDate),
    archiveUiHiddenAfterAt: serializeDate(r.archiveUiHiddenAfterAt),
    replyReceivedAt: serializeDate(r.replyReceivedAt),
    pendingResponseDraftAt: serializeDate(r.pendingResponseDraftAt),
  };
}

function serializeEmailLead(
  r: Awaited<ReturnType<typeof prisma.outreachEmailLead.findMany>>[number],
): EmailLeadRow {
  return {
    ...r,
    autoClassification: classifyOutreachLead({
      status: r.status,
      platform: "email",
      outreachSentAt: r.outreachSentAt,
      followUp1SentAt: r.followUp1SentAt,
      followUp2SentAt: r.followUp2SentAt,
      responseReceivedAt: r.responseReceivedAt,
      createdAt: r.createdAt,
    }),
    followUp1EmailSubject: r.followUp1EmailSubject ?? "",
    followUp1EmailBody: r.followUp1EmailBody ?? "",
    followUp2EmailSubject: r.followUp2EmailSubject ?? "",
    followUp2EmailBody: r.followUp2EmailBody ?? "",
    createdAt: r.createdAt.toISOString(),
    deletedAt: serializeDate(r.deletedAt),
    savedToHubAt: serializeDate(r.savedToHubAt),
    deadLeadAt: serializeDate(r.deadLeadAt),
    archivedAt: serializeDate(r.archivedAt),
    archivePurgeAfterAt: serializeDate(r.archivePurgeAfterAt),
    outreachSentAt: serializeDate(r.outreachSentAt),
    followUp1SentAt: serializeDate(r.followUp1SentAt),
    followUp2SentAt: serializeDate(r.followUp2SentAt),
    responseReceivedAt: serializeDate(r.responseReceivedAt),
    queuedForDate: serializeDate(r.queuedForDate),
    followUp1DueAt: serializeDate(r.followUp1DueAt),
    followUp1LastRemindedAt: serializeDate(r.followUp1LastRemindedAt),
    followUp2DueAt: serializeDate(r.followUp2DueAt),
    followUp2LastRemindedAt: serializeDate(r.followUp2LastRemindedAt),
    archiveUiHiddenAfterAt: serializeDate(r.archiveUiHiddenAfterAt),
    replyReceivedAt: serializeDate(r.replyReceivedAt),
    pendingResponseDraftAt: serializeDate(r.pendingResponseDraftAt),
  };
}

/** Active generation-page leads: not saved to hub, not dead, not archived. */
const generationLeadWhere = {
  deletedAt: null,
  savedToHubAt: null,
  archivedAt: null,
  status: { not: "DEAD_LEAD" },
} as const;

export async function listOutreachLeads(platform: OutreachPlatform, includeDeleted = false) {
  await ensureOutreachReady();
  // Match Fit HQ only ever shows Match Fit leads — NI Services rows live in their own lane.
  const where = scopedToMatchFit(includeDeleted ? {} : generationLeadWhere);

  if (platform === "instagram") {
    const rows = await prisma.outreachInstagramLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => serializeInstagramLead(r));
  }

  if (platform === "facebook") {
    const rows = await prisma.outreachFacebookLead.findMany({ where, orderBy: { createdAt: "desc" } });
    return rows.map((r) => serializeFacebookLead(r));
  }

  if (platform === "email") {
    const rows = await prisma.outreachEmailLead.findMany({ where, orderBy: { createdAt: "desc" } });
    return rows.map((r) => serializeEmailLead(r));
  }

  return [];
}

export async function listOutreachArchiveLeads(now = new Date()): Promise<OutreachArchiveLead[]> {
  await ensureOutreachReady();
  // Archived rows are never deleted (NI-Brain history preserved); they simply drop out of the
  // Archives UI once past their 7-day UI-hide window. Rows with no window set stay visible.
  const archiveWhere = scopedToMatchFit({
    deletedAt: null,
    archivedAt: { not: null } as const,
    OR: [{ archiveUiHiddenAfterAt: null }, { archiveUiHiddenAfterAt: { gt: now } }],
  });

  const [instagram, facebook, email] = await Promise.all([
    prisma.outreachInstagramLead.findMany({ where: archiveWhere, orderBy: { archivedAt: "desc" } }),
    prisma.outreachFacebookLead.findMany({ where: archiveWhere, orderBy: { archivedAt: "desc" } }),
    prisma.outreachEmailLead.findMany({ where: archiveWhere, orderBy: { archivedAt: "desc" } }),
  ]);

  const combined: OutreachArchiveLead[] = [
    ...instagram.map((r) => ({
      platform: "instagram" as const,
      archivedAt: r.archivedAt!.toISOString(),
      deadLeadAt: serializeDate(r.deadLeadAt),
      archivePurgeAfterAt: serializeDate(r.archivePurgeAfterAt),
      lead: serializeInstagramLead(r),
    })),
    ...facebook.map((r) => ({
      platform: "facebook" as const,
      archivedAt: r.archivedAt!.toISOString(),
      deadLeadAt: serializeDate(r.deadLeadAt),
      archivePurgeAfterAt: serializeDate(r.archivePurgeAfterAt),
      lead: serializeFacebookLead(r),
    })),
    ...email.map((r) => ({
      platform: "email" as const,
      archivedAt: r.archivedAt!.toISOString(),
      deadLeadAt: serializeDate(r.deadLeadAt),
      archivePurgeAfterAt: serializeDate(r.archivePurgeAfterAt),
      lead: serializeEmailLead(r),
    })),
  ];

  return combined.sort(
    (a, b) => new Date(b.archivedAt ?? 0).getTime() - new Date(a.archivedAt ?? 0).getTime(),
  );
}

export async function listOutreachHubLeads(): Promise<OutreachHubLead[]> {
  await ensureOutreachReady();
  try {
    await backfillOutreachHubLeads();
  } catch (e) {
    console.error("[listOutreachHubLeads] backfill skipped:", e);
  }
  const hubWhere = scopedToMatchFit({
    deletedAt: null,
    savedToHubAt: { not: null } as const,
    archivedAt: null,
  });

  const [instagram, facebook, email] = await Promise.all([
    prisma.outreachInstagramLead.findMany({ where: hubWhere, orderBy: { savedToHubAt: "desc" } }),
    prisma.outreachFacebookLead.findMany({ where: hubWhere, orderBy: { savedToHubAt: "desc" } }),
    prisma.outreachEmailLead.findMany({ where: hubWhere, orderBy: { savedToHubAt: "desc" } }),
  ]);

  const combined: OutreachHubLead[] = [
    ...instagram.map((r) => ({
      platform: "instagram" as const,
      savedToHubAt: r.savedToHubAt!.toISOString(),
      lead: serializeInstagramLead(r),
    })),
    ...facebook.map((r) => ({
      platform: "facebook" as const,
      savedToHubAt: r.savedToHubAt!.toISOString(),
      lead: serializeFacebookLead(r),
    })),
    ...email.map((r) => ({
      platform: "email" as const,
      savedToHubAt: r.savedToHubAt!.toISOString(),
      lead: serializeEmailLead(r),
    })),
  ];

  return combined.sort(
    (a, b) => new Date(b.savedToHubAt).getTime() - new Date(a.savedToHubAt).getTime(),
  );
}

export type OutreachPipelineStats = OutreachHubStats;

/** Aggregate Outreach Hub metrics plus archive count. */
export async function getOutreachPipelineStats(): Promise<OutreachPipelineStats> {
  await ensureOutreachReady();

  const [hubEntries, archived] = await Promise.all([
    listOutreachHubLeads(),
    listOutreachArchiveLeads(),
  ]);

  return computeOutreachHubStats(hubEntries, archived.length);
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function hubLeadDisplayName(entry: OutreachHubLead): string {
  if (entry.platform === "instagram") return (entry.lead as InstagramLeadRow).handle;
  if (entry.platform === "facebook") return (entry.lead as FacebookLeadRow).pageName;
  return (entry.lead as EmailLeadRow).name;
}

function hubLeadContact(entry: OutreachHubLead): string {
  if (entry.platform === "instagram") return (entry.lead as InstagramLeadRow).profileUrl;
  if (entry.platform === "facebook") return (entry.lead as FacebookLeadRow).pageUrl;
  return (entry.lead as EmailLeadRow).email;
}

function hubLeadOutreachCopy(entry: OutreachHubLead): string {
  if (entry.platform === "instagram") {
    const lead = entry.lead as InstagramLeadRow;
    return `DM: ${lead.dmText}\nComment: ${lead.commentText}`;
  }
  if (entry.platform === "facebook") return (entry.lead as FacebookLeadRow).pagePostText;
  const lead = entry.lead as EmailLeadRow;
  return `Subject: ${lead.emailSubject}\n\n${lead.emailBody}`;
}

export function buildOutreachHubCsv(leads: OutreachHubLead[]): string {
  const headers = [
    "Platform",
    "Name",
    "Contact",
    "Target Group",
    "Status",
    "Classification",
    "Likelihood Score",
    "Why Match Fit",
    "Outreach Copy",
    "Saved To Hub At",
    "Created At",
  ];

  const rows = leads.map((entry) => [
    entry.platform,
    hubLeadDisplayName(entry),
    hubLeadContact(entry),
    "targetGroup" in entry.lead ? entry.lead.targetGroup : "",
    entry.lead.status,
    entry.lead.autoClassification,
    entry.lead.likelihoodScore,
    entry.lead.whyMatchFit,
    hubLeadOutreachCopy(entry),
    entry.savedToHubAt,
    entry.lead.createdAt,
  ]);

  return [headers, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");
}

export async function softDeleteOutreachLead(platform: OutreachPlatform, id: string) {
  await ensureOutreachReady();
  const now = new Date();
  if (platform === "instagram") {
    return prisma.outreachInstagramLead.update({ where: { id }, data: { deletedAt: now } });
  }
  if (platform === "facebook") {
    return prisma.outreachFacebookLead.update({ where: { id }, data: { deletedAt: now } });
  }
  if (platform === "email") {
    return prisma.outreachEmailLead.update({ where: { id }, data: { deletedAt: now } });
  }
  throw new Error(`Unsupported outreach platform: ${platform}`);
}

export type MassDeleteOutreachInput =
  | { mode: "all" }
  | { mode: "batch"; generationBatchId: string }
  | { mode: "ids"; ids: string[] };

export function buildMassDeleteOutreachWhere(input: MassDeleteOutreachInput) {
  const where: {
    deletedAt: null;
    savedToHubAt: null;
    archivedAt: null;
    status: { not: string };
    generationBatchId?: string;
    id?: { in: string[] };
  } = {
    ...generationLeadWhere,
  };

  if (input.mode === "batch") {
    where.generationBatchId = input.generationBatchId;
  } else if (input.mode === "ids") {
    where.id = { in: input.ids };
  }

  return where;
}

export async function massSoftDeleteOutreachLeads(
  platform: OutreachPlatform,
  input: MassDeleteOutreachInput,
): Promise<{ deletedCount: number }> {
  await ensureOutreachReady();
  const now = new Date();
  const where = buildMassDeleteOutreachWhere(input);

  if (input.mode === "ids" && input.ids.length === 0) {
    return { deletedCount: 0 };
  }

  if (platform === "instagram") {
    const result = await prisma.outreachInstagramLead.updateMany({ where, data: { deletedAt: now } });
    return { deletedCount: result.count };
  }
  if (platform === "facebook") {
    const result = await prisma.outreachFacebookLead.updateMany({ where, data: { deletedAt: now } });
    return { deletedCount: result.count };
  }
  if (platform === "email") {
    const result = await prisma.outreachEmailLead.updateMany({ where, data: { deletedAt: now } });
    return { deletedCount: result.count };
  }

  throw new Error(`Unsupported outreach platform: ${platform}`);
}

export type MassSaveOutreachInput = MassDeleteOutreachInput;

export function buildMassSaveOutreachWhere(input: MassSaveOutreachInput) {
  return buildMassDeleteOutreachWhere(input);
}

export async function saveOutreachLeadToHub(platform: OutreachPlatform, id: string) {
  await ensureOutreachReady();
  const now = new Date();
  if (platform === "instagram") {
    return prisma.outreachInstagramLead.update({ where: { id }, data: { savedToHubAt: now } });
  }
  if (platform === "facebook") {
    return prisma.outreachFacebookLead.update({ where: { id }, data: { savedToHubAt: now } });
  }
  if (platform === "email") {
    return prisma.outreachEmailLead.update({ where: { id }, data: { savedToHubAt: now } });
  }
  throw new Error(`Unsupported outreach platform: ${platform}`);
}

export async function massSaveOutreachLeadsToHub(
  platform: OutreachPlatform,
  input: MassSaveOutreachInput,
): Promise<{ savedCount: number }> {
  await ensureOutreachReady();
  const now = new Date();
  const where = buildMassSaveOutreachWhere(input);

  if (input.mode === "ids" && input.ids.length === 0) {
    return { savedCount: 0 };
  }

  if (platform === "instagram") {
    const result = await prisma.outreachInstagramLead.updateMany({ where, data: { savedToHubAt: now } });
    return { savedCount: result.count };
  }
  if (platform === "facebook") {
    const result = await prisma.outreachFacebookLead.updateMany({ where, data: { savedToHubAt: now } });
    return { savedCount: result.count };
  }
  if (platform === "email") {
    const result = await prisma.outreachEmailLead.updateMany({ where, data: { savedToHubAt: now } });
    return { savedCount: result.count };
  }

  throw new Error(`Unsupported outreach platform: ${platform}`);
}

export async function updateOutreachLead(
  platform: OutreachPlatform,
  id: string,
  patch: Record<string, unknown>,
) {
  await ensureOutreachReady();
  if (platform === "instagram") {
    const existing = await prisma.outreachInstagramLead.findUnique({ where: { id } });
    if (!existing) return null;
    const status = typeof patch.status === "string" ? patch.status : existing.status;
    const stamps = statusTimestampsForUpdate(
      status as OutreachLeadStatus,
      {
        outreachSentAt: existing.outreachSentAt,
        followUp1SentAt: existing.followUp1SentAt,
        followUp2SentAt: existing.followUp2SentAt,
        responseReceivedAt: existing.responseReceivedAt,
      },
      undefined,
      existing.status,
    );
    const autoClassification = classifyOutreachLead({
      status,
      platform: "instagram",
      ...stamps,
      createdAt: existing.createdAt,
    });
    const deadLeadAt =
      status === "DEAD_LEAD" && !existing.deadLeadAt ? new Date() : status !== "DEAD_LEAD" ? null : undefined;
    return prisma.outreachInstagramLead.update({
      where: { id },
      data: {
        dmText: typeof patch.dmText === "string" ? patch.dmText : undefined,
        commentText: typeof patch.commentText === "string" ? patch.commentText : undefined,
        followUp1DmText: typeof patch.followUp1DmText === "string" ? patch.followUp1DmText : undefined,
        followUp2DmText: typeof patch.followUp2DmText === "string" ? patch.followUp2DmText : undefined,
        outreachIntent:
          patch.outreachIntent === null
            ? null
            : typeof patch.outreachIntent === "string"
              ? patch.outreachIntent
              : undefined,
        status,
        dmTextEdited: patch.dmTextEdited === true ? true : undefined,
        commentTextEdited: patch.commentTextEdited === true ? true : undefined,
        autoClassification,
        savedToHubAt: patch.saveToHub === true ? new Date() : undefined,
        deadLeadAt,
        ...stamps,
      },
    });
  }

  if (platform === "facebook") {
    const existing = await prisma.outreachFacebookLead.findUnique({ where: { id } });
    if (!existing) return null;
    const status = typeof patch.status === "string" ? patch.status : existing.status;
    const stamps = facebookStatusTimestampsForUpdate(status, {
      outreachSentAt: existing.outreachSentAt,
      responseReceivedAt: existing.responseReceivedAt,
    });
    const deadLeadAt =
      status === "DEAD_LEAD" && !existing.deadLeadAt ? new Date() : status !== "DEAD_LEAD" ? null : undefined;
    return prisma.outreachFacebookLead.update({
      where: { id },
      data: {
        pagePostText: typeof patch.pagePostText === "string" ? patch.pagePostText : undefined,
        outreachIntent:
          patch.outreachIntent === null
            ? null
            : typeof patch.outreachIntent === "string"
              ? patch.outreachIntent
              : undefined,
        status,
        pagePostTextEdited: patch.pagePostTextEdited === true ? true : undefined,
        autoClassification: classifyOutreachLead({
          status,
          platform: "facebook",
          outreachSentAt: stamps.outreachSentAt,
          followUp1SentAt: null,
          followUp2SentAt: null,
          responseReceivedAt: stamps.responseReceivedAt,
          createdAt: existing.createdAt,
        }),
        savedToHubAt: patch.saveToHub === true ? new Date() : undefined,
        deadLeadAt,
        outreachSentAt: stamps.outreachSentAt,
        responseReceivedAt: stamps.responseReceivedAt,
      },
    });
  }

  if (platform === "email") {
    const existing = await prisma.outreachEmailLead.findUnique({ where: { id } });
    if (!existing) return null;
    const status = typeof patch.status === "string" ? patch.status : existing.status;
    const stamps = statusTimestampsForUpdate(
      status,
      {
        outreachSentAt: existing.outreachSentAt,
        followUp1SentAt: existing.followUp1SentAt,
        followUp2SentAt: existing.followUp2SentAt,
        responseReceivedAt: existing.responseReceivedAt,
      },
      undefined,
      existing.status,
    );
    const deadLeadAt =
      status === "DEAD_LEAD" && !existing.deadLeadAt ? new Date() : status !== "DEAD_LEAD" ? null : undefined;
    return prisma.outreachEmailLead.update({
      where: { id },
      data: {
        emailSubject: typeof patch.emailSubject === "string" ? patch.emailSubject : undefined,
        emailBody: typeof patch.emailBody === "string" ? patch.emailBody : undefined,
        followUp1EmailSubject:
          typeof patch.followUp1EmailSubject === "string" ? patch.followUp1EmailSubject : undefined,
        followUp1EmailBody: typeof patch.followUp1EmailBody === "string" ? patch.followUp1EmailBody : undefined,
        followUp2EmailSubject:
          typeof patch.followUp2EmailSubject === "string" ? patch.followUp2EmailSubject : undefined,
        followUp2EmailBody: typeof patch.followUp2EmailBody === "string" ? patch.followUp2EmailBody : undefined,
        outreachIntent:
          patch.outreachIntent === null
            ? null
            : typeof patch.outreachIntent === "string"
              ? patch.outreachIntent
              : undefined,
        status,
        emailBodyEdited: patch.emailBodyEdited === true ? true : undefined,
        autoClassification: classifyOutreachLead({
          status,
          platform: "email",
          ...stamps,
          createdAt: existing.createdAt,
        }),
        savedToHubAt: patch.saveToHub === true ? new Date() : undefined,
        deadLeadAt,
        ...stamps,
      },
    });
  }

  return null;
}

export async function getOutreachHubStats(): Promise<{
  total: number;
  followUp: number;
  responses: number;
}> {
  const entries = await listOutreachHubLeads();
  const active = entries.filter((e) => !e.lead.deletedAt);
  return {
    total: active.length,
    followUp: active.filter((e) => e.lead.autoClassification === "FOLLOW_UP_NEEDED").length,
    responses: active.filter((e) => e.lead.status === "RESPONSE_RECEIVED").length,
  };
}

export async function purgeArchivedOutreachLeads(): Promise<{
  instagram: number;
  facebook: number;
  email: number;
}> {
  await ensureOutreachReady();
  const [instagram, facebook, email] = await Promise.all([
    prisma.outreachInstagramLead.deleteMany({ where: { deletedAt: { not: null } } }),
    prisma.outreachFacebookLead.deleteMany({ where: { deletedAt: { not: null } } }),
    prisma.outreachEmailLead.deleteMany({ where: { deletedAt: { not: null } } }),
  ]);
  return {
    instagram: instagram.count,
    facebook: facebook.count,
    email: email.count,
  };
}

export async function purgeActiveOutreachLeads(): Promise<{
  instagram: number;
  facebook: number;
  email: number;
}> {
  await ensureOutreachReady();
  const [instagram, facebook, email] = await Promise.all([
    prisma.outreachInstagramLead.deleteMany({ where: { deletedAt: null } }),
    prisma.outreachFacebookLead.deleteMany({ where: { deletedAt: null } }),
    prisma.outreachEmailLead.deleteMany({ where: { deletedAt: null } }),
  ]);
  return {
    instagram: instagram.count,
    facebook: facebook.count,
    email: email.count,
  };
}

export async function refreshAllOutreachClassifications() {
  await ensureOutreachReady();
  const [ig, fb, em] = await Promise.all([
    prisma.outreachInstagramLead.findMany({ where: { deletedAt: null } }),
    prisma.outreachFacebookLead.findMany({ where: { deletedAt: null } }),
    prisma.outreachEmailLead.findMany({ where: { deletedAt: null } }),
  ]);

  await Promise.all([
    ...ig.map((r) =>
      prisma.outreachInstagramLead.update({
        where: { id: r.id },
        data: {
          autoClassification: classifyOutreachLead({
            status: r.status,
            platform: "instagram",
            outreachSentAt: r.outreachSentAt,
            followUp1SentAt: r.followUp1SentAt,
            followUp2SentAt: r.followUp2SentAt,
            responseReceivedAt: r.responseReceivedAt,
            createdAt: r.createdAt,
          }),
        },
      }),
    ),
    ...fb.map((r) =>
      prisma.outreachFacebookLead.update({
        where: { id: r.id },
        data: {
          autoClassification: classifyOutreachLead({
            status: r.status,
            platform: "facebook",
            outreachSentAt: r.outreachSentAt,
            followUp1SentAt: null,
            followUp2SentAt: null,
            responseReceivedAt: r.responseReceivedAt,
            createdAt: r.createdAt,
          }),
        },
      }),
    ),
    ...em.map((r) =>
      prisma.outreachEmailLead.update({
        where: { id: r.id },
        data: {
          autoClassification: classifyOutreachLead({
            status: r.status,
            platform: "email",
            outreachSentAt: r.outreachSentAt,
            followUp1SentAt: r.followUp1SentAt,
            followUp2SentAt: r.followUp2SentAt,
            responseReceivedAt: r.responseReceivedAt,
            createdAt: r.createdAt,
          }),
        },
      }),
    ),
  ]);
}
