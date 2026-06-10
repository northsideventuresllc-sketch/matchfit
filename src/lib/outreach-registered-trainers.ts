import "server-only";

import {
  adminPortalTrainerListWhere,
  adminPortalTrainerListWhereLegacy,
  redactEmailForAdminPortal,
} from "@/lib/admin-portal-list-filters";
import { normalizeInstagramHandle, normalizeInstagramProfileUrl } from "@/lib/outreach-exclusions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export type RegisteredTrainerOutreachRow = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  instagramHandle: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  fitnessNiches: string | null;
  createdAt: string;
};

function displayName(row: {
  preferredName: string | null;
  firstName: string;
  lastName: string;
  username: string;
}): string {
  const preferred = row.preferredName?.trim();
  if (preferred) return preferred;
  const full = `${row.firstName} ${row.lastName}`.trim();
  return full || row.username;
}

async function loadRegisteredTrainers(where: ReturnType<typeof adminPortalTrainerListWhere>) {
  return prisma.trainer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      username: true,
      preferredName: true,
      firstName: true,
      lastName: true,
      email: true,
      socialInstagram: true,
      socialFacebook: true,
      fitnessNiches: true,
      createdAt: true,
    },
  });
}

export async function listRegisteredTrainersForOutreach(): Promise<RegisteredTrainerOutreachRow[]> {
  let rows;
  try {
    rows = await loadRegisteredTrainers(adminPortalTrainerListWhere());
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      rows = await loadRegisteredTrainers(adminPortalTrainerListWhereLegacy());
    } else {
      throw error;
    }
  }

  return rows.map((row) => {
    const handle = normalizeInstagramHandle(row.socialInstagram);
    return {
      id: row.id,
      username: row.username,
      displayName: displayName(row),
      email: redactEmailForAdminPortal(row.email, row.username, "trainer"),
      instagramHandle: handle,
      instagramUrl: handle ? normalizeInstagramProfileUrl(handle) : null,
      facebookUrl: row.socialFacebook?.trim() || null,
      fitnessNiches: row.fitnessNiches?.trim() || null,
      createdAt: row.createdAt.toISOString(),
    };
  });
}
