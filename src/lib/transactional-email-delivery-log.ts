import "server-only";

import { prisma } from "@/lib/prisma";
import type { TransactionalEmailKind } from "@/lib/transactional-email-kinds";
import type { SendTransactionalEmailAudience } from "@/lib/transactional-email-send";

export type EmailDeliveryStatus = "sent" | "skipped_prefs" | "skipped_no_recipient" | "failed";

export async function logTransactionalEmailDelivery(args: {
  kind: TransactionalEmailKind;
  audience: SendTransactionalEmailAudience;
  toEmail: string;
  subject: string;
  status: EmailDeliveryStatus;
  resendId?: string | null;
  errorMessage?: string | null;
  clientId?: string | null;
  trainerId?: string | null;
}): Promise<void> {
  try {
    await prisma.transactionalEmailDelivery.create({
      data: {
        kind: args.kind,
        audience: args.audience,
        toEmail: args.toEmail,
        subject: args.subject,
        status: args.status,
        resendId: args.resendId ?? null,
        errorMessage: args.errorMessage ?? null,
        clientId: args.clientId ?? null,
        trainerId: args.trainerId ?? null,
      },
    });
  } catch (e) {
    console.warn("[transactional email log] failed to persist delivery row", e);
  }
}

export type AdminEmailStatsPanel = {
  windowDays: number;
  totalAttempts: number;
  sent: number;
  skippedPrefs: number;
  skippedNoRecipient: number;
  failed: number;
  byKind: { kind: string; sent: number; failed: number }[];
  recent: {
    id: string;
    at: string;
    kind: string;
    toEmail: string;
    status: string;
    subject: string;
  }[];
};

export async function getAdminEmailStatsPanel(windowDays = 7): Promise<AdminEmailStatsPanel> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [rows, recent] = await Promise.all([
    prisma.transactionalEmailDelivery.groupBy({
      by: ["status", "kind"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.transactionalEmailDelivery.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        createdAt: true,
        kind: true,
        toEmail: true,
        status: true,
        subject: true,
      },
    }),
  ]);

  let sent = 0;
  let skippedPrefs = 0;
  let skippedNoRecipient = 0;
  let failed = 0;
  const kindMap = new Map<string, { sent: number; failed: number }>();

  for (const row of rows) {
    const n = row._count._all;
    if (row.status === "sent") sent += n;
    else if (row.status === "skipped_prefs") skippedPrefs += n;
    else if (row.status === "skipped_no_recipient") skippedNoRecipient += n;
    else if (row.status === "failed") failed += n;

    const entry = kindMap.get(row.kind) ?? { sent: 0, failed: 0 };
    if (row.status === "sent") entry.sent += n;
    if (row.status === "failed") entry.failed += n;
    kindMap.set(row.kind, entry);
  }

  return {
    windowDays,
    totalAttempts: sent + skippedPrefs + skippedNoRecipient + failed,
    sent,
    skippedPrefs,
    skippedNoRecipient,
    failed,
    byKind: [...kindMap.entries()]
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.sent - a.sent)
      .slice(0, 12),
    recent: recent.map((r) => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      kind: r.kind,
      toEmail: r.toEmail,
      status: r.status,
      subject: r.subject,
    })),
  };
}
