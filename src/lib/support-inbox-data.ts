import "server-only";

import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";
import { sendMatchFitBrandedEmail } from "@/lib/match-fit-branded-email";

const SUPPORT_REPLY_TO = "support@match-fit.net";

export type SupportInboxRow = {
  id: string;
  createdAt: string;
  fromEmail: string;
  subject: string;
  textPreview: string;
  textBody: string;
  status: string;
  replyBody: string | null;
  repliedAt: string | null;
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
        replyBody: true,
        repliedAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      fromEmail: r.fromEmail,
      subject: r.subject,
      textPreview: (r.textBody ?? "").slice(0, 240),
      textBody: r.textBody ?? "",
      status: r.status,
      replyBody: r.replyBody ?? null,
      repliedAt: r.repliedAt ? r.repliedAt.toISOString() : null,
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
  const data = {
    fromEmail: args.fromEmail,
    toEmail: args.toEmail,
    subject: args.subject,
    textBody: args.textBody ?? null,
    htmlBody: args.htmlBody ?? null,
    status: "unread" as const,
  };

  try {
    if (args.resendEmailId?.trim()) {
      await prisma.supportInboxMessage.upsert({
        where: { resendEmailId: args.resendEmailId },
        create: { ...data, resendEmailId: args.resendEmailId },
        update: {
          ...data,
          status: "unread",
        },
      });
      return;
    }

    await prisma.supportInboxMessage.create({ data });
  } catch (e) {
    console.warn("[support inbox] failed to store message", e);
  }
}

/**
 * Reply to a support message from inside the admin portal (MF-SUPPORT-INBOX).
 * Sends from the Match Fit branded address so the thread stays on-brand, and
 * records the reply on the row so the inbox shows what was already answered.
 */
export async function replyToSupportMessage(
  id: string,
  body: string,
): Promise<{ ok: true; emailId?: string } | { ok: false; error: string }> {
  const text = body.trim();
  if (text.length < 2) return { ok: false, error: "Reply is empty." };

  const msg = await prisma.supportInboxMessage.findUnique({
    where: { id },
    select: { fromEmail: true, subject: true, textBody: true },
  });
  if (!msg) return { ok: false, error: "Message not found." };

  const subject = msg.subject.toLowerCase().startsWith("re:")
    ? msg.subject
    : `Re: ${msg.subject}`;
  const quoted = (msg.textBody ?? "").trim();
  const fullText = quoted ? `${text}\n\n---\n${quoted}` : text;

  let emailId: string | undefined;
  try {
    emailId = await sendMatchFitBrandedEmail({
      to: msg.fromEmail,
      subject,
      text: fullText,
      replyTo: SUPPORT_REPLY_TO,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed." };
  }

  await prisma.supportInboxMessage.update({
    where: { id },
    data: {
      status: "replied",
      replyBody: text,
      repliedAt: new Date(),
      replyEmailId: emailId ?? null,
    },
  });

  return { ok: true, emailId };
}
