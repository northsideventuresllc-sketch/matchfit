export const SITE_ANALYTICS_VISITOR_COOKIE = "mf_site_vid";
export const SITE_ANALYTICS_SESSION_KEY = "mf_site_sid";

export const SITE_ANALYTICS_KINDS = ["PAGE_VIEW", "LINK_CLICK"] as const;
export type SiteAnalyticsKind = (typeof SITE_ANALYTICS_KINDS)[number];

export type SiteAnalyticsIngestPayload = {
  kind: SiteAnalyticsKind;
  path: string;
  targetPath?: string | null;
  targetUrl?: string | null;
  linkLabel?: string | null;
  visitorId: string;
  sessionId: string;
};

export type AdminTrafficTopPage = { path: string; uniqueVisitors: number };
export type AdminTrafficTopLink = { target: string; label: string | null; uniqueClickers: number };

export type AdminTrafficSnapshot = {
  windowDays: number;
  uniqueVisitors: number;
  pageViews: number;
  linkClicks: number;
  topPages: AdminTrafficTopPage[];
  topLinks: AdminTrafficTopLink[];
};

const BOT_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|lighthouse|headless|phantom|wget|curl\/|python-requests/i;

export function isSiteAnalyticsBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua?.trim()) return false;
  return BOT_RE.test(ua);
}

export function parseSiteAnalyticsIngestBody(body: unknown): SiteAnalyticsIngestPayload | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const kind = o.kind;
  if (kind !== "PAGE_VIEW" && kind !== "LINK_CLICK") return null;
  const path = typeof o.path === "string" ? o.path.trim().slice(0, 512) : "";
  const visitorId = typeof o.visitorId === "string" ? o.visitorId.trim().slice(0, 64) : "";
  const sessionId = typeof o.sessionId === "string" ? o.sessionId.trim().slice(0, 64) : "";
  if (!path || !visitorId || !sessionId) return null;
  return {
    kind,
    path,
    targetPath: typeof o.targetPath === "string" ? o.targetPath.trim().slice(0, 512) : null,
    targetUrl: typeof o.targetUrl === "string" ? o.targetUrl.trim().slice(0, 512) : null,
    linkLabel: typeof o.linkLabel === "string" ? o.linkLabel.trim().slice(0, 120) : null,
    visitorId,
    sessionId,
  };
}
