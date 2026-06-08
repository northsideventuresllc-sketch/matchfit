/** Client-safe site analytics constants, types, and ingest parsing (no Prisma). */

export const SITE_ANALYTICS_KINDS = [
  "PAGE_VIEW",
  "LINK_CLICK",
  "FORM_FIELD_FOCUS",
  "FORM_SUBMIT_ATTEMPT",
  "FORM_SUBMIT_ERROR",
  "FORM_SUBMIT_SUCCESS",
] as const;
export type SiteAnalyticsKind = (typeof SITE_ANALYTICS_KINDS)[number];

export const SITE_ANALYTICS_FORM_KINDS = [
  "FORM_FIELD_FOCUS",
  "FORM_SUBMIT_ATTEMPT",
  "FORM_SUBMIT_ERROR",
  "FORM_SUBMIT_SUCCESS",
] as const;
export type SiteAnalyticsFormKind = (typeof SITE_ANALYTICS_FORM_KINDS)[number];

export const SITE_ANALYTICS_VISITOR_COOKIE = "mf_vid";
export const SITE_ANALYTICS_SESSION_KEY = "mf_sid";
export const SITE_ANALYTICS_UTM_COOKIE = "mf_utm";

const UTM_MAX = 120;

const PATH_MAX = 500;
const LABEL_MAX = 200;
const URL_MAX = 500;
const ID_MAX = 64;

const BOT_UA =
  /bot|crawler|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|bytespider/i;

export type SiteAnalyticsUtm = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
};

export type SiteAnalyticsIngestPayload = SiteAnalyticsUtm & {
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

export type AdminTrafficFormStats = {
  fieldFocus: number;
  submitAttempts: number;
  submitErrors: number;
  submitSuccesses: number;
};

export type AdminTrafficSnapshot = {
  windowDays: number;
  pageViews: number;
  uniqueVisitors: number;
  linkClicks: number;
  formEvents: AdminTrafficFormStats;
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

function isFormKind(kind: string): kind is SiteAnalyticsFormKind {
  return (
    kind === "FORM_FIELD_FOCUS" ||
    kind === "FORM_SUBMIT_ATTEMPT" ||
    kind === "FORM_SUBMIT_ERROR" ||
    kind === "FORM_SUBMIT_SUCCESS"
  );
}

function normalizeUtmValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = trimTo(raw, UTM_MAX);
  if (!t) return null;
  return t;
}

export function parseUtmFromSearchParams(params: URLSearchParams): SiteAnalyticsUtm {
  return {
    utmSource: normalizeUtmValue(params.get("utm_source")),
    utmMedium: normalizeUtmValue(params.get("utm_medium")),
    utmCampaign: normalizeUtmValue(params.get("utm_campaign")),
    utmContent: normalizeUtmValue(params.get("utm_content")),
    utmTerm: normalizeUtmValue(params.get("utm_term")),
  };
}

export function hasAnyUtm(utm: SiteAnalyticsUtm): boolean {
  return Boolean(
    utm.utmSource || utm.utmMedium || utm.utmCampaign || utm.utmContent || utm.utmTerm,
  );
}

export function serializeUtmCookie(utm: SiteAnalyticsUtm): string {
  return JSON.stringify({
    s: utm.utmSource,
    m: utm.utmMedium,
    c: utm.utmCampaign,
    n: utm.utmContent,
    t: utm.utmTerm,
  });
}

export function parseUtmCookie(raw: string | null): SiteAnalyticsUtm | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const utm: SiteAnalyticsUtm = {
      utmSource: normalizeUtmValue(typeof parsed.s === "string" ? parsed.s : null),
      utmMedium: normalizeUtmValue(typeof parsed.m === "string" ? parsed.m : null),
      utmCampaign: normalizeUtmValue(typeof parsed.c === "string" ? parsed.c : null),
      utmContent: normalizeUtmValue(typeof parsed.n === "string" ? parsed.n : null),
      utmTerm: normalizeUtmValue(typeof parsed.t === "string" ? parsed.t : null),
    };
    return hasAnyUtm(utm) ? utm : null;
  } catch {
    return null;
  }
}

export function isSiteAnalyticsBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent?.trim()) return false;
  return BOT_UA.test(userAgent);
}

export function parseSiteAnalyticsIngestBody(body: unknown): SiteAnalyticsIngestPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const kind = typeof b.kind === "string" ? b.kind.toUpperCase() : "";
  if (!SITE_ANALYTICS_KINDS.includes(kind as SiteAnalyticsKind)) return null;

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
  if (isFormKind(kind) && !linkLabel) return null;

  const utmSource = normalizeUtmValue(typeof b.utmSource === "string" ? b.utmSource : null);
  const utmMedium = normalizeUtmValue(typeof b.utmMedium === "string" ? b.utmMedium : null);
  const utmCampaign = normalizeUtmValue(typeof b.utmCampaign === "string" ? b.utmCampaign : null);
  const utmContent = normalizeUtmValue(typeof b.utmContent === "string" ? b.utmContent : null);
  const utmTerm = normalizeUtmValue(typeof b.utmTerm === "string" ? b.utmTerm : null);

  return {
    kind: kind as SiteAnalyticsKind,
    path,
    targetPath,
    targetUrl,
    linkLabel,
    visitorId,
    sessionId,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
  };
}
