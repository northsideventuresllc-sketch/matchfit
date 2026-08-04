import "server-only";

import { prisma } from "@/lib/prisma";

/** Cap on statements per batched transaction so a large backfill stays bounded. */
const UPDATE_BATCH_SIZE = 200;

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

  // Signals arrive oldest-first and each update only lands while savedToHubAt is
  // still null, so the earliest signal per lead is the only one that can ever win.
  // Every later duplicate is a guaranteed no-op (count 0), so collapse them first.
  const earliestByLead = new Map<string, { platform: string; savedAt: Date }>();
  for (const signal of signalRows) {
    if (!signal.leadId || earliestByLead.has(signal.leadId)) continue;
    earliestByLead.set(signal.leadId, { platform: signal.platform, savedAt: signal.createdAt });
  }

  // Leads saved in the same bulk action share a createdAt, so group by
  // (platform, savedAt) and set each distinct timestamp with a single updateMany.
  const groups = new Map<string, { platform: string; savedAt: Date; ids: string[] }>();
  for (const [leadId, { platform, savedAt }] of earliestByLead) {
    if (platform !== "instagram" && platform !== "facebook" && platform !== "email") continue;
    const groupKey = `${platform}:${savedAt.getTime()}`;
    const group = groups.get(groupKey);
    if (group) group.ids.push(leadId);
    else groups.set(groupKey, { platform, savedAt, ids: [leadId] });
  }

  const operations = [...groups.values()].map(({ platform, savedAt, ids }) => {
    const args = {
      where: { id: { in: ids }, savedToHubAt: null, deletedAt: null },
      data: { savedToHubAt: savedAt },
    };
    if (platform === "instagram") return prisma.outreachInstagramLead.updateMany(args);
    if (platform === "facebook") return prisma.outreachFacebookLead.updateMany(args);
    return prisma.outreachEmailLead.updateMany(args);
  });

  let savedToHubAtFromSignals = 0;
  // One round trip per chunk instead of one per signal row.
  for (let i = 0; i < operations.length; i += UPDATE_BATCH_SIZE) {
    const results = await prisma.$transaction(operations.slice(i, i + UPDATE_BATCH_SIZE));
    for (const result of results) savedToHubAtFromSignals += result.count;
  }

  return {
    savedToHubAtFromSignals,
    legacyOtherLeadsTagged: 0,
  };
}
