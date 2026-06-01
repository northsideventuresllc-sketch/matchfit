import "server-only";

import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";
import type {
  AdminTrafficSnapshot,
  SiteAnalyticsIngestPayload,
} from "@/lib/site-analytics-shared";

export {
  SITE_ANALYTICS_KINDS,
  SITE_ANALYTICS_SESSION_KEY,
  SITE_ANALYTICS_VISITOR_COOKIE,
  isSiteAnalyticsBotUserAgent,
  parseSiteAnalyticsIngestBody,
} from "@/lib/site-analytics-shared";
export type {
  AdminTrafficSnapshot,
  AdminTrafficTopLink,
  AdminTrafficTopPage,
  SiteAnalyticsIngestPayload,
} from "@/lib/site-analytics-shared";

type TopPageRow = { path: string; unique_visitors: bigint };
type TopLinkRow = { target: string; label: string | null; unique_clickers: bigint };
type CountRow = { n: bigint };

const EMPTY_TRAFFIC = (days: number): AdminTrafficSnapshot => ({
  windowDays: days,
  uniqueVisitors: 0,
  pageViews: 0,
  linkClicks: 0,
  topPages: [],
  topLinks: [],
});

export async function recordSiteAnalyticsEvent(payload: SiteAnalyticsIngestPayload): Promise<void> {
  await prisma.siteAnalyticsEvent.create({
    data: {
      kind: payload.kind,
      path: payload.path,
      targetPath: payload.targetPath ?? null,
      targetUrl: payload.targetUrl ?? null,
      linkLabel: payload.linkLabel ?? null,
      visitorId: payload.visitorId,
      sessionId: payload.sessionId,
    },
  });
}

export async function getAdminSiteTrafficSnapshot(windowDays = 7): Promise<AdminTrafficSnapshot> {
  const days = Math.min(30, Math.max(1, Math.floor(windowDays)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const [visitorsRow, pageViewsRow, linkClicksRow, topPages, topLinks] = await Promise.all([
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(DISTINCT "visitorId")::bigint AS n
        FROM site_analytics_events
        WHERE "createdAt" >= ${since}
      `,
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n
        FROM site_analytics_events
        WHERE "createdAt" >= ${since} AND kind = 'PAGE_VIEW'
      `,
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n
        FROM site_analytics_events
        WHERE "createdAt" >= ${since} AND kind = 'LINK_CLICK'
      `,
      prisma.$queryRaw<TopPageRow[]>`
        SELECT path, COUNT(DISTINCT "visitorId")::bigint AS unique_visitors
        FROM site_analytics_events
        WHERE "createdAt" >= ${since} AND kind = 'PAGE_VIEW'
        GROUP BY path
        ORDER BY unique_visitors DESC
        LIMIT 5
      `,
      prisma.$queryRaw<TopLinkRow[]>`
        SELECT
          COALESCE("targetPath", "targetUrl", 'unknown') AS target,
          MAX("linkLabel") AS label,
          COUNT(DISTINCT "visitorId")::bigint AS unique_clickers
        FROM site_analytics_events
        WHERE "createdAt" >= ${since} AND kind = 'LINK_CLICK'
        GROUP BY COALESCE("targetPath", "targetUrl", 'unknown')
        ORDER BY unique_clickers DESC
        LIMIT 5
      `,
    ]);

    return {
      windowDays: days,
      uniqueVisitors: Number(visitorsRow[0]?.n ?? 0),
      pageViews: Number(pageViewsRow[0]?.n ?? 0),
      linkClicks: Number(linkClicksRow[0]?.n ?? 0),
      topPages: topPages.map((r) => ({ path: r.path, uniqueVisitors: Number(r.unique_visitors) })),
      topLinks: topLinks.map((r) => ({
        target: r.target,
        label: r.label,
        uniqueClickers: Number(r.unique_clickers),
      })),
    };
  } catch (e) {
    if (isPrismaMissingTableError(e, "site_analytics_events")) {
      return EMPTY_TRAFFIC(days);
    }
    throw e;
  }
}
