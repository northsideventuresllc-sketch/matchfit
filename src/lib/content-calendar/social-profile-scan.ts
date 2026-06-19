import "server-only";

import { MATCH_FIT_OFFICIAL_SOCIAL_LINKS } from "@/lib/match-fit-official-social";
import { recordContentLearning } from "@/lib/ni-brain-client";

export type SocialProfileSnapshot = {
  platform: string;
  label: string;
  url: string;
  status: number;
  title: string;
  description: string;
  visibleText: string;
  fetchedAt: string;
  error?: string;
};

export type SocialProfileScanResult = {
  profiles: SocialProfileSnapshot[];
  summary: string;
  scannedAt: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, key: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${key}["']`,
    "i",
  );
  const m = html.match(re);
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

function titleFromHtml(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function extractJsonLdSnippets(html: string): string {
  const matches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) ?? [];
  return matches
    .map((block) => block.replace(/<\/?script[^>]*>/gi, "").trim())
    .join("\n")
    .slice(0, 1500);
}

async function fetchSocialProfile(link: (typeof MATCH_FIT_OFFICIAL_SOCIAL_LINKS)[number]): Promise<SocialProfileSnapshot> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(link.href, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "MatchFit-ContentCalendar/1.0 (+https://match-fit.net)",
      },
      signal: AbortSignal.timeout(25_000),
      next: { revalidate: 0 },
    });
    const html = await res.text();
    const title = metaContent(html, "og:title") || titleFromHtml(html);
    const description =
      metaContent(html, "og:description") ||
      metaContent(html, "description") ||
      metaContent(html, "twitter:description");
    const jsonLd = extractJsonLdSnippets(html);
    const visibleText = stripHtml(html).slice(0, 2000);
    const combined = [description, jsonLd, visibleText].filter(Boolean).join("\n\n");
    return {
      platform: link.platform,
      label: link.label,
      url: link.href,
      status: res.status,
      title,
      description,
      visibleText: combined.slice(0, 3000),
      fetchedAt,
    };
  } catch (e) {
    return {
      platform: link.platform,
      label: link.label,
      url: link.href,
      status: 0,
      title: "",
      description: "",
      visibleText: "",
      fetchedAt,
      error: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

export function summarizeSocialProfileScan(result: Omit<SocialProfileScanResult, "summary">): string {
  const lines = [`Match Fit social profile scan at ${result.scannedAt}:`];
  for (const profile of result.profiles) {
    lines.push(`\n## ${profile.label} (${profile.url})`);
    if (profile.error || profile.status !== 200) {
      lines.push(`Fetch: ${profile.error ?? `HTTP ${profile.status}`} — analysis must note limited data.`);
      continue;
    }
    if (profile.title) lines.push(`Title: ${profile.title}`);
    if (profile.description) lines.push(`Description: ${profile.description.slice(0, 500)}`);
    if (profile.visibleText) {
      lines.push(`Visible page text (truncated):\n${profile.visibleText.slice(0, 900)}`);
    }
  }
  lines.push(
    "\nUse ONLY the fetched fields above for performance claims. If a platform blocked the fetch, say so — do not invent metrics.",
  );
  return lines.join("\n");
}

export async function scanMatchFitSocialProfiles(): Promise<SocialProfileScanResult> {
  const scannedAt = new Date().toISOString();
  const profiles = await Promise.all(MATCH_FIT_OFFICIAL_SOCIAL_LINKS.map((link) => fetchSocialProfile(link)));
  const partial = { profiles, scannedAt };
  return { ...partial, summary: summarizeSocialProfileScan(partial) };
}

export async function scanAndRecordSocialProfiles(): Promise<SocialProfileScanResult> {
  const result = await scanMatchFitSocialProfiles();
  await recordContentLearning({
    signalType: "SOCIAL_SCAN",
    editedText: result.summary.slice(0, 4000),
    meta: {
      scannedAt: result.scannedAt,
      platforms: result.profiles.map((p) => ({
        platform: p.platform,
        status: p.status,
        title: p.title,
        error: p.error ?? null,
      })),
    },
  });
  return result;
}
