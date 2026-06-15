import "server-only";

import { prisma } from "@/lib/prisma";

export type OutreachHubBackfillSummary = {
  restoredDeletedHubLeads: number;
  savedToHubAtFromSignals: number;
  legacyOtherLeadsTagged: number;
};

/**
 * Idempotent repair for outreach rows saved before hub migrations or hidden by
 * soft-delete after bulk-save. Safe to run on every schema-repair / hub load.
 */
export async function backfillOutreachHubLeads(): Promise<OutreachHubBackfillSummary> {
  const [igRestored, fbRestored, emRestored] = await Promise.all([
    prisma.outreachInstagramLead.updateMany({
      where: { savedToHubAt: { not: null }, deletedAt: { not: null }, archivedAt: null },
      data: { deletedAt: null },
    }),
    prisma.outreachFacebookLead.updateMany({
      where: { savedToHubAt: { not: null }, deletedAt: { not: null }, archivedAt: null },
      data: { deletedAt: null },
    }),
    prisma.outreachEmailLead.updateMany({
      where: { savedToHubAt: { not: null }, deletedAt: { not: null }, archivedAt: null },
      data: { deletedAt: null },
    }),
  ]);

  const signalRows = await prisma.outreachLearningSignal.findMany({
    where: { signalType: "SAVED_TO_HUB", leadId: { not: null } },
    select: { leadId: true, platform: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  let savedToHubAtFromSignals = 0;
  for (const signal of signalRows) {
    if (!signal.leadId) continue;
    const savedAt = signal.createdAt;
    if (signal.platform === "instagram") {
      const result = await prisma.outreachInstagramLead.updateMany({
        where: { id: signal.leadId, savedToHubAt: null, deletedAt: null },
        data: { savedToHubAt: savedAt },
      });
      savedToHubAtFromSignals += result.count;
    } else if (signal.platform === "facebook") {
      const result = await prisma.outreachFacebookLead.updateMany({
        where: { id: signal.leadId, savedToHubAt: null, deletedAt: null },
        data: { savedToHubAt: savedAt },
      });
      savedToHubAtFromSignals += result.count;
    } else if (signal.platform === "email") {
      const result = await prisma.outreachEmailLead.updateMany({
        where: { id: signal.leadId, savedToHubAt: null, deletedAt: null },
        data: { savedToHubAt: savedAt },
      });
      savedToHubAtFromSignals += result.count;
    } else if (signal.platform === "other") {
      const result = await prisma.outreachOtherLead.updateMany({
        where: { id: signal.leadId, savedToHubAt: null, deletedAt: null },
        data: { savedToHubAt: savedAt },
      });
      savedToHubAtFromSignals += result.count;
    }
  }

  const legacyOther = await prisma.outreachOtherLead.updateMany({
    where: { deletedAt: null, savedToHubAt: null },
    data: { savedToHubAt: new Date() },
  });

  return {
    restoredDeletedHubLeads: igRestored.count + fbRestored.count + emRestored.count,
    savedToHubAtFromSignals,
    legacyOtherLeadsTagged: legacyOther.count,
  };
}
