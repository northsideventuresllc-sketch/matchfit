import "server-only";

import { classifyOutreachLead, statusTimestampsForUpdate } from "@/lib/outreach-classification";
import type { OutreachLeadStatus, OutreachPlatform } from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";

function serializeDate(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

export async function listOutreachLeads(platform: OutreachPlatform, includeDeleted = false) {
  const where = includeDeleted ? {} : { deletedAt: null };

  if (platform === "instagram") {
    const rows = await prisma.outreachInstagramLead.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => {
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
        outreachSentAt: serializeDate(r.outreachSentAt),
        followUp1SentAt: serializeDate(r.followUp1SentAt),
        followUp2SentAt: serializeDate(r.followUp2SentAt),
        responseReceivedAt: serializeDate(r.responseReceivedAt),
      };
    });
  }

  if (platform === "facebook") {
    const rows = await prisma.outreachFacebookLead.findMany({ where, orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({
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
      outreachSentAt: serializeDate(r.outreachSentAt),
      responseReceivedAt: serializeDate(r.responseReceivedAt),
    }));
  }

  if (platform === "email") {
    const rows = await prisma.outreachEmailLead.findMany({ where, orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({
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
      outreachSentAt: serializeDate(r.outreachSentAt),
      followUp1SentAt: serializeDate(r.followUp1SentAt),
      followUp2SentAt: serializeDate(r.followUp2SentAt),
      responseReceivedAt: serializeDate(r.responseReceivedAt),
    }));
  }

  const rows = await prisma.outreachOtherLead.findMany({ where, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({
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
    outreachSentAt: serializeDate(r.outreachSentAt),
    followUp1SentAt: serializeDate(r.followUp1SentAt),
    followUp2SentAt: serializeDate(r.followUp2SentAt),
    responseReceivedAt: serializeDate(r.responseReceivedAt),
  }));
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
