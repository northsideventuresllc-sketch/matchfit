import "server-only";

import { classifyOutreachLead, statusTimestampsForUpdate } from "@/lib/outreach-classification";
import type {
  EmailLeadRow,
  FacebookLeadRow,
  InstagramLeadRow,
  OtherLeadRow,
  OutreachHubLead,
  OutreachLeadStatus,
  OutreachPlatform,
} from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";

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
    createdAt: r.createdAt.toISOString(),
    deletedAt: serializeDate(r.deletedAt),
    savedToHubAt: serializeDate(r.savedToHubAt),
    outreachSentAt: serializeDate(r.outreachSentAt),
    followUp1SentAt: serializeDate(r.followUp1SentAt),
    followUp2SentAt: serializeDate(r.followUp2SentAt),
    responseReceivedAt: serializeDate(r.responseReceivedAt),
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
    outreachSentAt: serializeDate(r.outreachSentAt),
    responseReceivedAt: serializeDate(r.responseReceivedAt),
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
    createdAt: r.createdAt.toISOString(),
    deletedAt: serializeDate(r.deletedAt),
    savedToHubAt: serializeDate(r.savedToHubAt),
    outreachSentAt: serializeDate(r.outreachSentAt),
    followUp1SentAt: serializeDate(r.followUp1SentAt),
    followUp2SentAt: serializeDate(r.followUp2SentAt),
    responseReceivedAt: serializeDate(r.responseReceivedAt),
  };
}

function serializeOtherLead(
  r: Awaited<ReturnType<typeof prisma.outreachOtherLead.findMany>>[number],
): OtherLeadRow {
  return {
    ...r,
    autoClassification: classifyOutreachLead({
      status: r.status,
      platform: "other",
      outreachSentAt: r.outreachSentAt,
      followUp1SentAt: r.followUp1SentAt,
      followUp2SentAt: r.followUp2SentAt,
      responseReceivedAt: r.responseReceivedAt,
      createdAt: r.createdAt,
    }),
    createdAt: r.createdAt.toISOString(),
    deletedAt: serializeDate(r.deletedAt),
    savedToHubAt: serializeDate(r.savedToHubAt),
    outreachSentAt: serializeDate(r.outreachSentAt),
    followUp1SentAt: serializeDate(r.followUp1SentAt),
    followUp2SentAt: serializeDate(r.followUp2SentAt),
    responseReceivedAt: serializeDate(r.responseReceivedAt),
  };
}

export async function listOutreachLeads(platform: OutreachPlatform, includeDeleted = false) {
  const where = includeDeleted ? {} : { deletedAt: null };

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

  const rows = await prisma.outreachOtherLead.findMany({ where, orderBy: { createdAt: "desc" } });
  return rows.map((r) => serializeOtherLead(r));
}

export async function listOutreachHubLeads(): Promise<OutreachHubLead[]> {
  const hubWhere = { deletedAt: null, savedToHubAt: { not: null } as const };

  const [instagram, facebook, email, other] = await Promise.all([
    prisma.outreachInstagramLead.findMany({ where: hubWhere, orderBy: { savedToHubAt: "desc" } }),
    prisma.outreachFacebookLead.findMany({ where: hubWhere, orderBy: { savedToHubAt: "desc" } }),
    prisma.outreachEmailLead.findMany({ where: hubWhere, orderBy: { savedToHubAt: "desc" } }),
    prisma.outreachOtherLead.findMany({ where: hubWhere, orderBy: { savedToHubAt: "desc" } }),
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
    ...other.map((r) => ({
      platform: "other" as const,
      savedToHubAt: r.savedToHubAt!.toISOString(),
      lead: serializeOtherLead(r),
    })),
  ];

  return combined.sort(
    (a, b) => new Date(b.savedToHubAt).getTime() - new Date(a.savedToHubAt).getTime(),
  );
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
  if (entry.platform === "email") return (entry.lead as EmailLeadRow).name;
  return (entry.lead as OtherLeadRow).contactLabel;
}

function hubLeadContact(entry: OutreachHubLead): string {
  if (entry.platform === "instagram") return (entry.lead as InstagramLeadRow).profileUrl;
  if (entry.platform === "facebook") return (entry.lead as FacebookLeadRow).pageUrl;
  if (entry.platform === "email") return (entry.lead as EmailLeadRow).email;
  return (entry.lead as OtherLeadRow).contactUrl ?? "";
}

function hubLeadOutreachCopy(entry: OutreachHubLead): string {
  if (entry.platform === "instagram") {
    const lead = entry.lead as InstagramLeadRow;
    return `DM: ${lead.dmText}\nComment: ${lead.commentText}`;
  }
  if (entry.platform === "facebook") return (entry.lead as FacebookLeadRow).pagePostText;
  if (entry.platform === "email") {
    const lead = entry.lead as EmailLeadRow;
    return `Subject: ${lead.emailSubject}\n\n${lead.emailBody}`;
  }
  return (entry.lead as OtherLeadRow).outreachText;
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
  return prisma.outreachOtherLead.update({ where: { id }, data: { deletedAt: now } });
}

export type MassDeleteOutreachInput =
  | { mode: "all" }
  | { mode: "batch"; generationBatchId: string }
  | { mode: "ids"; ids: string[] };

export function buildMassDeleteOutreachWhere(input: MassDeleteOutreachInput) {
  const where: { deletedAt: null; generationBatchId?: string; id?: { in: string[] } } = {
    deletedAt: null,
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

  const result = await prisma.outreachOtherLead.updateMany({ where, data: { deletedAt: now } });
  return { deletedCount: result.count };
}

export type MassSaveOutreachInput = MassDeleteOutreachInput;

export function buildMassSaveOutreachWhere(input: MassSaveOutreachInput) {
  return buildMassDeleteOutreachWhere(input);
}

export async function saveOutreachLeadToHub(platform: OutreachPlatform, id: string) {
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
  return prisma.outreachOtherLead.update({ where: { id }, data: { savedToHubAt: now } });
}

export async function massSaveOutreachLeadsToHub(
  platform: OutreachPlatform,
  input: MassSaveOutreachInput,
): Promise<{ savedCount: number }> {
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

  const result = await prisma.outreachOtherLead.updateMany({ where, data: { savedToHubAt: now } });
  return { savedCount: result.count };
}

export async function updateOutreachLead(
  platform: OutreachPlatform,
  id: string,
  patch: Record<string, unknown>,
) {
  if (platform === "instagram") {
    const existing = await prisma.outreachInstagramLead.findUnique({ where: { id } });
    if (!existing) return null;
    const status = typeof patch.status === "string" ? patch.status : existing.status;
    const stamps = statusTimestampsForUpdate(status as OutreachLeadStatus, {
      outreachSentAt: existing.outreachSentAt,
      followUp1SentAt: existing.followUp1SentAt,
      followUp2SentAt: existing.followUp2SentAt,
      responseReceivedAt: existing.responseReceivedAt,
    });
    const autoClassification = classifyOutreachLead({
      status,
      platform: "instagram",
      ...stamps,
      createdAt: existing.createdAt,
    });
    return prisma.outreachInstagramLead.update({
      where: { id },
      data: {
        dmText: typeof patch.dmText === "string" ? patch.dmText : undefined,
        commentText: typeof patch.commentText === "string" ? patch.commentText : undefined,
        status,
        dmTextEdited: patch.dmTextEdited === true ? true : undefined,
        commentTextEdited: patch.commentTextEdited === true ? true : undefined,
        autoClassification,
        savedToHubAt: patch.saveToHub === true ? new Date() : undefined,
        ...stamps,
      },
    });
  }

  if (platform === "facebook") {
    const existing = await prisma.outreachFacebookLead.findUnique({ where: { id } });
    if (!existing) return null;
    const status = typeof patch.status === "string" ? patch.status : existing.status;
    const stamps = statusTimestampsForUpdate(status as OutreachLeadStatus, {
      outreachSentAt: existing.outreachSentAt,
      followUp1SentAt: null,
      followUp2SentAt: null,
      responseReceivedAt: existing.responseReceivedAt,
    });
    return prisma.outreachFacebookLead.update({
      where: { id },
      data: {
        pagePostText: typeof patch.pagePostText === "string" ? patch.pagePostText : undefined,
        status,
        pagePostTextEdited: patch.pagePostTextEdited === true ? true : undefined,
        autoClassification: classifyOutreachLead({
          status,
          platform: "facebook",
          ...stamps,
          followUp1SentAt: null,
          followUp2SentAt: null,
          createdAt: existing.createdAt,
        }),
        savedToHubAt: patch.saveToHub === true ? new Date() : undefined,
        ...stamps,
      },
    });
  }

  if (platform === "email") {
    const existing = await prisma.outreachEmailLead.findUnique({ where: { id } });
    if (!existing) return null;
    const status = typeof patch.status === "string" ? patch.status : existing.status;
    const stamps = statusTimestampsForUpdate(status as OutreachLeadStatus, {
      outreachSentAt: existing.outreachSentAt,
      followUp1SentAt: existing.followUp1SentAt,
      followUp2SentAt: existing.followUp2SentAt,
      responseReceivedAt: existing.responseReceivedAt,
    });
    return prisma.outreachEmailLead.update({
      where: { id },
      data: {
        emailSubject: typeof patch.emailSubject === "string" ? patch.emailSubject : undefined,
        emailBody: typeof patch.emailBody === "string" ? patch.emailBody : undefined,
        status,
        emailBodyEdited: patch.emailBodyEdited === true ? true : undefined,
        autoClassification: classifyOutreachLead({
          status,
          platform: "email",
          ...stamps,
          createdAt: existing.createdAt,
        }),
        savedToHubAt: patch.saveToHub === true ? new Date() : undefined,
        ...stamps,
      },
    });
  }

  const existing = await prisma.outreachOtherLead.findUnique({ where: { id } });
  if (!existing) return null;
  const status = typeof patch.status === "string" ? patch.status : existing.status;
  const stamps = statusTimestampsForUpdate(status as "LEAD", {
    outreachSentAt: existing.outreachSentAt,
    followUp1SentAt: existing.followUp1SentAt,
    followUp2SentAt: existing.followUp2SentAt,
    responseReceivedAt: existing.responseReceivedAt,
  });
  return prisma.outreachOtherLead.update({
    where: { id },
    data: {
      outreachText: typeof patch.outreachText === "string" ? patch.outreachText : undefined,
      status,
      outreachTextEdited: patch.outreachTextEdited === true ? true : undefined,
      autoClassification: classifyOutreachLead({
        status,
        platform: "other",
        ...stamps,
        createdAt: existing.createdAt,
      }),
      savedToHubAt: patch.saveToHub === true ? new Date() : undefined,
      ...stamps,
    },
  });
}

export async function purgeArchivedOutreachLeads(): Promise<{
  instagram: number;
  facebook: number;
  email: number;
  other: number;
}> {
  const [instagram, facebook, email, other] = await Promise.all([
    prisma.outreachInstagramLead.deleteMany({ where: { deletedAt: { not: null } } }),
    prisma.outreachFacebookLead.deleteMany({ where: { deletedAt: { not: null } } }),
    prisma.outreachEmailLead.deleteMany({ where: { deletedAt: { not: null } } }),
    prisma.outreachOtherLead.deleteMany({ where: { deletedAt: { not: null } } }),
  ]);
  return {
    instagram: instagram.count,
    facebook: facebook.count,
    email: email.count,
    other: other.count,
  };
}

export async function purgeActiveOutreachLeads(): Promise<{
  instagram: number;
  facebook: number;
  email: number;
  other: number;
}> {
  const [instagram, facebook, email, other] = await Promise.all([
    prisma.outreachInstagramLead.deleteMany({ where: { deletedAt: null } }),
    prisma.outreachFacebookLead.deleteMany({ where: { deletedAt: null } }),
    prisma.outreachEmailLead.deleteMany({ where: { deletedAt: null } }),
    prisma.outreachOtherLead.deleteMany({ where: { deletedAt: null } }),
  ]);
  return {
    instagram: instagram.count,
    facebook: facebook.count,
    email: email.count,
    other: other.count,
  };
}

export async function refreshAllOutreachClassifications() {
  const [ig, fb, em, ot] = await Promise.all([
    prisma.outreachInstagramLead.findMany({ where: { deletedAt: null } }),
    prisma.outreachFacebookLead.findMany({ where: { deletedAt: null } }),
    prisma.outreachEmailLead.findMany({ where: { deletedAt: null } }),
    prisma.outreachOtherLead.findMany({ where: { deletedAt: null } }),
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
    ...ot.map((r) =>
      prisma.outreachOtherLead.update({
        where: { id: r.id },
        data: {
          autoClassification: classifyOutreachLead({
            status: r.status,
            platform: "other",
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
