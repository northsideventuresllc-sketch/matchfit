/** Client-safe site analytics constants, types, and ingest parsing (no Prisma). */

export const SITE_ANALYTICS_KINDS = ["PAGE_VIEW", "LINK_CLICK"] as const;
export type SiteAnalyticsKind = (typeof SITE_ANALYTICS_KINDS)[number];

export const SITE_ANALYTICS_VISITOR_COOKIE = "mf_vid";
export const SITE_ANALYTICS_SESSION_KEY = "mf_sid";

const PATH_MAX = 500;
const LABEL_MAX = 200;
const URL_MAX = 500;
const ID_MAX = 64;

const BOT_UA =
  /bot|crawler|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|bytespider/i;

export type SiteAnalyticsIngestPayload = {
  kind: SiteAnalyticsKind;
  path: string;
  targetPath?: string | null;
  targetUrl?: string | null;
  linkLabel?: string | null;
  visitorId: string;
  sessionId: string;
};

export type AdminTrafficTopPage = {
  path: string;
  views: number;
};

export type AdminTrafficTopLink = {
  target: string;
  label: string | null;
  clicks: number;
};

export type AdminTrafficDayPoint = {
  dayKey: string;
  pageViews: number;
  uniqueVisitors: number;
};

export type AdminTrafficSnapshot = {
  windowDays: number;
  pageViews: number;
  uniqueVisitors: number;
  linkClicks: number;
  topPages: AdminTrafficTopPage[];
  topLinks: AdminTrafficTopLink[];
  daily: AdminTrafficDayPoint[];
  recentEvents: {
    at: string;
    kind: SiteAnalyticsKind;
    path: string;
    target: string | null;
    label: string | null;
  }[];
};

function trimTo(value: string, max: number): string {
  const t = value.trim();
  if (t.length <= max) return t;
  return t.slice(0, max);
}

function normalizePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  const noQuery = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
  if (!noQuery.startsWith("/")) return null;
  if (noQuery.startsWith("/api/")) return null;
  if (noQuery.startsWith("/admin")) return null;
  return trimTo(noQuery, PATH_MAX);
}

function normalizeOptionalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return normalizePath(raw);
}

function normalizeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = trimTo(raw, URL_MAX);
  if (!/^https?:\/\//i.test(t)) return null;
  return t;
}

function normalizeId(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 8 || t.length > ID_MAX) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return null;
  return t;
}

export function isSiteAnalyticsBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent?.trim()) return false;
  return BOT_UA.test(userAgent);
}

export function parseSiteAnalyticsIngestBody(body: unknown): SiteAnalyticsIngestPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const kind = typeof b.kind === "string" ? b.kind.toUpperCase() : "";
  if (kind !== "PAGE_VIEW" && kind !== "LINK_CLICK") return null;

  const path = typeof b.path === "string" ? normalizePath(b.path) : null;
  if (!path) return null;

  const visitorId = typeof b.visitorId === "string" ? normalizeId(b.visitorId) : null;
  const sessionId = typeof b.sessionId === "string" ? normalizeId(b.sessionId) : null;
  if (!visitorId || !sessionId) return null;

  const targetPath =
    typeof b.targetPath === "string" ? normalizeOptionalPath(b.targetPath) : null;
  const targetUrl =
    typeof b.targetUrl === "string" ? normalizeExternalUrl(b.targetUrl) : null;
  const linkLabel =
    typeof b.linkLabel === "string" ? trimTo(b.linkLabel, LABEL_MAX) || null : null;

  if (kind === "LINK_CLICK" && !targetPath && !targetUrl) return null;

  return {
    kind,
    path,
    targetPath,
    targetUrl,
    linkLabel,
    visitorId,
    sessionId,
  };
}
