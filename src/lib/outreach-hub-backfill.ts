import "server-only";

import { prisma } from "@/lib/prisma";

export type OutreachHubBackfillSummary = {
  savedToHubAtFromSignals: number;
  legacyOtherLeadsTagged: number;
};

/**
 * Idempotent repair for outreach rows saved before hub migrations. Safe to run on
 * every schema-repair / hub load.
 */
export async function backfillOutreachHubLeads(): Promise<OutreachHubBackfillSummary> {
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
    }
  }

  return {
    savedToHubAtFromSignals,
    legacyOtherLeadsTagged: 0,
  };
}
