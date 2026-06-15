import "server-only";

import type { OutreachPlatform } from "@/lib/outreach-types";
import {
  OUTREACH_ARCHIVE_RETENTION_DAYS,
  OUTREACH_DEAD_LEAD_ARCHIVE_HOURS,
} from "@/lib/outreach-types";
import { prisma } from "@/lib/prisma";
import { ensureOutreachHubSchema } from "@/lib/ensure-outreach-hub-schema";

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

export type OutreachArchiveJobSummary = {
  archivedCount: number;
  purgedCount: number;
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
  const archiveData = { archivedAt: now, archivePurgeAfterAt: purgeAfterFromArchived(now) };

  const [igArchived, fbArchived, emArchived] = await Promise.all([
    prisma.outreachInstagramLead.updateMany({
      where: {
        status: "DEAD_LEAD",
        deadLeadAt: { lte: cutoff },
        archivedAt: null,
        deletedAt: null,
      },
      data: archiveData,
    }),
    prisma.outreachFacebookLead.updateMany({
      where: {
        status: "DEAD_LEAD",
        deadLeadAt: { lte: cutoff },
        archivedAt: null,
        deletedAt: null,
      },
      data: archiveData,
    }),
    prisma.outreachEmailLead.updateMany({
      where: {
        status: "DEAD_LEAD",
        deadLeadAt: { lte: cutoff },
        archivedAt: null,
        deletedAt: null,
      },
      data: archiveData,
    }),
  ]);

  const [igPurged, fbPurged, emPurged] = await Promise.all([
    prisma.outreachInstagramLead.deleteMany({
      where: { archivedAt: { not: null }, archivePurgeAfterAt: { lte: now } },
    }),
    prisma.outreachFacebookLead.deleteMany({
      where: { archivedAt: { not: null }, archivePurgeAfterAt: { lte: now } },
    }),
    prisma.outreachEmailLead.deleteMany({
      where: { archivedAt: { not: null }, archivePurgeAfterAt: { lte: now } },
    }),
  ]);

  return {
    archivedCount: igArchived.count + fbArchived.count + emArchived.count,
    purgedCount: igPurged.count + fbPurged.count + emPurged.count,
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
