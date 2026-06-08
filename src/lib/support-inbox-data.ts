import "server-only";

import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";

export type SupportInboxRow = {
  id: string;
  createdAt: string;
  fromEmail: string;
  subject: string;
  textPreview: string;
  status: string;
};

export async function listSupportInboxMessages(limit = 50): Promise<SupportInboxRow[]> {
  try {
    const rows = await prisma.supportInboxMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        fromEmail: true,
        subject: true,
        textBody: true,
        status: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      fromEmail: r.fromEmail,
      subject: r.subject,
      textPreview: (r.textBody ?? "").slice(0, 240),
      status: r.status,
    }));
  } catch (e) {
    if (isPrismaMissingTableError(e, "support_inbox_messages")) return [];
    throw e;
  }
}

export async function markSupportMessageRead(id: string): Promise<void> {
  await prisma.supportInboxMessage.update({
    where: { id },
    data: { status: "read" },
  });
}

export async function storeSupportInboxMessage(args: {
  resendEmailId?: string | null;
  fromEmail: string;
  toEmail: string;
  subject: string;
  textBody?: string | null;
  htmlBody?: string | null;
}): Promise<void> {
  try {
    await prisma.supportInboxMessage.create({
      data: {
        resendEmailId: args.resendEmailId ?? null,
        fromEmail: args.fromEmail,
        toEmail: args.toEmail,
        subject: args.subject,
        textBody: args.textBody ?? null,
        htmlBody: args.htmlBody ?? null,
        status: "unread",
      },
    });
  } catch (e) {
    console.warn("[support inbox] failed to store message", e);
  }
}
