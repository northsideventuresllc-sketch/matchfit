import "server-only";

import { recordContentLearning } from "@/lib/ni-brain-client";

export type WebsiteScanPage = {
  path: string;
  url: string;
  title: string;
  description: string;
  excerpt: string;
  fetchedAt: string;
  status: number;
};

export type WebsiteScanResult = {
  baseUrl: string;
  pages: WebsiteScanPage[];
  summary: string;
  scannedAt: string;
};

const SCAN_PATHS = ["/", "/promos"] as const;

function resolveSiteBaseUrl(): string {
  const fromEnv =
    process.env.MATCH_FIT_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!fromEnv) return "https://match-fit.net";
  if (fromEnv.startsWith("http")) return fromEnv.replace(/\/$/, "");
  return `https://${fromEnv.replace(/\/$/, "")}`;
}

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

async function fetchPage(baseUrl: string, path: string): Promise<WebsiteScanPage> {
  const url = `${baseUrl}${path}`;
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": "MatchFit-ContentCalendar/1.0" },
      signal: AbortSignal.timeout(20_000),
      next: { revalidate: 0 },
    });
    const html = await res.text();
    const description =
      metaContent(html, "description") ||
      metaContent(html, "og:description") ||
      metaContent(html, "twitter:description");
    const title = metaContent(html, "og:title") || titleFromHtml(html);
    const excerpt = stripHtml(html).slice(0, 2500);
    return { path, url, title, description, excerpt, fetchedAt, status: res.status };
  } catch {
    return {
      path,
      url,
      title: "",
      description: "",
      excerpt: "",
      fetchedAt,
      status: 0,
    };
  }
}

export function summarizeWebsiteScan(result: Omit<WebsiteScanResult, "summary">): string {
  const lines = [`Match Fit website scan (${result.baseUrl}) at ${result.scannedAt}:`];
  for (const page of result.pages) {
    if (page.status !== 200) {
      lines.push(`- ${page.path}: fetch failed (status ${page.status})`);
      continue;
    }
    lines.push(`- ${page.path}: ${page.title || "Untitled"}`);
    if (page.description) lines.push(`  Description: ${page.description.slice(0, 280)}`);
    if (page.excerpt) lines.push(`  Content excerpt: ${page.excerpt.slice(0, 400)}…`);
  }
  return lines.join("\n");
}

export async function scanMatchFitWebsite(): Promise<WebsiteScanResult> {
  const baseUrl = resolveSiteBaseUrl();
  const scannedAt = new Date().toISOString();
  const pages = await Promise.all(SCAN_PATHS.map((path) => fetchPage(baseUrl, path)));
  const partial = { baseUrl, pages, scannedAt };
  const summary = summarizeWebsiteScan(partial);
  return { ...partial, summary };
}

export async function scanAndRecordWebsiteContext(): Promise<WebsiteScanResult> {
  const result = await scanMatchFitWebsite();
  await recordContentLearning({
    signalType: "WEBSITE_SCAN",
    editedText: result.summary.slice(0, 4000),
    meta: {
      scannedAt: result.scannedAt,
      baseUrl: result.baseUrl,
      paths: result.pages.map((p) => ({ path: p.path, status: p.status, title: p.title })),
    },
  });
  return result;
}
