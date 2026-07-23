import "server-only";

import type { OutreachPlatform } from "@/lib/outreach-types";
import {
  OUTREACH_ARCHIVE_RETENTION_DAYS,
  OUTREACH_ARCHIVE_UI_HIDE_DAYS,
  OUTREACH_DEAD_LEAD_ARCHIVE_HOURS,
} from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

export type OutreachArchiveJobSummary = {
  archivedCount: number;
  /**
   * Number of archived rows now past their UI-hide window. These rows are HIDDEN from the
   * Archives UI (query-time filter), never deleted — NI-Brain learning history is preserved.
   */
  uiHiddenCount: number;
};

async function ensureReady(): Promise<void> {
  await ensureOutreachHubSchema();
}

function archiveCutoff(now: Date): Date {
  return new Date(now.getTime() - OUTREACH_DEAD_LEAD_ARCHIVE_HOURS * MS_HOUR);
}

function purgeAfterFromArchived(archivedAt: Date): Date {
  return new Date(archivedAt.getTime() + OUTREACH_ARCHIVE_RETENTION_DAYS * MS_DAY);
}

/** archivedAt + 7 days — the instant an archived row drops out of the Archives UI (never deleted). */
export function uiHiddenAfterFromArchived(archivedAt: Date): Date {
  return new Date(archivedAt.getTime() + OUTREACH_ARCHIVE_UI_HIDE_DAYS * MS_DAY);
}

/** Immediately archives a hub-saved lead when an admin deletes it from Outreach Hub. */
export async function archiveHubOutreachLeadOnAdminDelete(
  platform: OutreachPlatform,
  id: string,
): Promise<boolean> {
  await ensureReady();
  const now = new Date();
  const data = {
    status: "DEAD_LEAD",
    deadLeadAt: now,
    archivedAt: now,
    archivePurgeAfterAt: purgeAfterFromArchived(now),
    archiveUiHiddenAfterAt: uiHiddenAfterFromArchived(now),
    outreachLane: "archived",
    autoClassification: "DEAD_LEAD",
    deletedAt: null,
  };

  if (platform === "instagram") {
    const row = await prisma.outreachInstagramLead.findUnique({ where: { id } });
    if (!row?.savedToHubAt) return false;
    await prisma.outreachInstagramLead.update({ where: { id }, data });
    return true;
  }
  if (platform === "facebook") {
    const row = await prisma.outreachFacebookLead.findUnique({ where: { id } });
    if (!row?.savedToHubAt) return false;
    await prisma.outreachFacebookLead.update({ where: { id }, data });
    return true;
  }
  if (platform === "email") {
    const row = await prisma.outreachEmailLead.findUnique({ where: { id } });
    if (!row?.savedToHubAt) return false;
    await prisma.outreachEmailLead.update({ where: { id }, data });
    return true;
  }
  return false;
}

export async function processOutreachArchiveJobs(now = new Date()): Promise<OutreachArchiveJobSummary> {
  await ensureReady();
  const cutoff = archiveCutoff(now);
  // Dead leads aged past the 48h window move into the archive lane with a computed UI-hide
  // window. The DB row is NEVER deleted — the Archives UI simply stops listing it after
  // archiveUiHiddenAfterAt (query-time filter) so NI-Brain learning history is preserved.
  const archiveData = {
    archivedAt: now,
    archivePurgeAfterAt: purgeAfterFromArchived(now),
    archiveUiHiddenAfterAt: uiHiddenAfterFromArchived(now),
    outreachLane: "archived",
  };
  const archiveWhere = {
    status: "DEAD_LEAD",
    deadLeadAt: { lte: cutoff },
    archivedAt: null,
    deletedAt: null,
  } as const;

  const [igArchived, fbArchived, emArchived] = await Promise.all([
    prisma.outreachInstagramLead.updateMany({ where: archiveWhere, data: archiveData }),
    prisma.outreachFacebookLead.updateMany({ where: archiveWhere, data: archiveData }),
    prisma.outreachEmailLead.updateMany({ where: archiveWhere, data: archiveData }),
  ]);

  // Count (do NOT delete) rows now past their UI-hide window, purely for observability.
  const uiHiddenWhere = {
    archivedAt: { not: null },
    archiveUiHiddenAfterAt: { lte: now },
  } as const;
  const [igHidden, fbHidden, emHidden] = await Promise.all([
    prisma.outreachInstagramLead.count({ where: uiHiddenWhere }),
    prisma.outreachFacebookLead.count({ where: uiHiddenWhere }),
    prisma.outreachEmailLead.count({ where: uiHiddenWhere }),
  ]);

  return {
    archivedCount: igArchived.count + fbArchived.count + emArchived.count,
    uiHiddenCount: igHidden + fbHidden + emHidden,
  };
}

export async function reviveArchivedOutreachLead(
  platform: OutreachPlatform,
  id: string,
): Promise<boolean> {
  await ensureReady();
  const now = new Date();
  const data = {
    status: "LEAD",
    deadLeadAt: null,
    archivedAt: null,
    archivePurgeAfterAt: null,
    archiveUiHiddenAfterAt: null,
    outreachLane: "pending",
    savedToHubAt: now,
    autoClassification: "ACTIVE_LEAD",
  };

  if (platform === "instagram") {
    const row = await prisma.outreachInstagramLead.findUnique({ where: { id } });
    if (!row || !row.archivedAt) return false;
    await prisma.outreachInstagramLead.update({ where: { id }, data });
    return true;
  }
  if (platform === "facebook") {
    const row = await prisma.outreachFacebookLead.findUnique({ where: { id } });
    if (!row || !row.archivedAt) return false;
    await prisma.outreachFacebookLead.update({ where: { id }, data });
    return true;
  }
  if (platform === "email") {
    const row = await prisma.outreachEmailLead.findUnique({ where: { id } });
    if (!row || !row.archivedAt) return false;
    await prisma.outreachEmailLead.update({ where: { id }, data });
    return true;
  }
  return false;
}
