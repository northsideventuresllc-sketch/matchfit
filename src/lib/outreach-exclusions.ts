import "server-only";

import { prisma } from "@/lib/prisma";
import type { OutreachPlatform } from "@/lib/outreach-types";

export function normalizeInstagramHandle(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const withoutAt = trimmed.replace(/^@+/, "");
  const fromUrl = withoutAt.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1];
  const handle = (fromUrl ?? withoutAt).replace(/\/.*$/, "").trim().toLowerCase();
  if (!handle || handle === "unknown" || handle.length < 2) return null;
  if (!/^[a-z0-9._]+$/.test(handle)) return null;
  return `@${handle}`;
}

export function normalizeInstagramProfileUrl(handle: string, rawUrl?: string | null): string {
  const normalized = normalizeInstagramHandle(handle);
  const slug = normalized?.replace(/^@/, "") ?? "";
  const url = (rawUrl ?? "").trim();
  if (url && /instagram\.com\/[A-Za-z0-9._]+/i.test(url)) {
    return url.split("?")[0].replace(/\/$/, "");
  }
  return `https://instagram.com/${slug}`;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** Handles, URLs, and emails already in outreach tables or registered on Match Fit. */
export async function getOutreachExclusionList(platform: OutreachPlatform): Promise<string[]> {
  const activeOnly = { deletedAt: null };
  const registered = await getRegisteredTrainerOutreachExclusions();
  const values = new Set<string>(registered);

  if (platform === "instagram") {
    const rows = await prisma.outreachInstagramLead.findMany({
      where: activeOnly,
      select: { handle: true, profileUrl: true },
    });
    for (const row of rows) {
      const handle = normalizeInstagramHandle(row.handle);
      if (handle) values.add(handle);
      values.add(row.profileUrl.toLowerCase());
    }
    return [...values];
  }

  if (platform === "facebook") {
    const rows = await prisma.outreachFacebookLead.findMany({
      where: activeOnly,
      select: { pageUrl: true, pageName: true },
    });
    for (const row of rows) {
      values.add(row.pageUrl.toLowerCase());
      values.add(row.pageName.toLowerCase());
    }
    return [...values];
  }

  if (platform === "email") {
    const rows = await prisma.outreachEmailLead.findMany({
      where: activeOnly,
      select: { email: true },
    });
    for (const row of rows) {
      const email = normalizeEmail(row.email);
      if (email) values.add(email);
    }
    return [...values];
  }

  const rows = await prisma.outreachOtherLead.findMany({
    where: activeOnly,
    select: { contactLabel: true, contactUrl: true },
  });
  for (const row of rows) {
    values.add(row.contactLabel.toLowerCase());
    if (row.contactUrl) values.add(row.contactUrl.toLowerCase());
  }
  return [...values];
}

export async function getRegisteredTrainerOutreachExclusions(): Promise<string[]> {
  const rows = await prisma.trainer.findMany({
    where: { deidentifiedAt: null },
    select: {
      email: true,
      username: true,
      profile: { select: { socialInstagram: true } },
      socialInstagram: true,
    },
  });

  const values = new Set<string>();
  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (email) values.add(email);
    if (row.username.trim()) values.add(row.username.trim().toLowerCase());
    const handle = normalizeInstagramHandle(row.profile?.socialInstagram);
    const handle = normalizeInstagramHandle(row.socialInstagram);
    if (handle) values.add(handle);
  }
  return [...values];
}

export function isExcludedValue(value: string, exclusions: string[]): boolean {
  const normalized = value.trim().toLowerCase();
  return exclusions.some((entry) => entry.trim().toLowerCase() === normalized);
}
