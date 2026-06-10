import "server-only";

import { prisma } from "@/lib/prisma";
import { isPrismaMissingTableError } from "@/lib/prisma-missing-column";
import {
  type AdminTrafficSnapshot,
  type SiteAnalyticsIngestPayload,
  type SiteAnalyticsKind,
} from "@/lib/site-analytics-shared";

export {
  SITE_ANALYTICS_KINDS,
  SITE_ANALYTICS_SESSION_KEY,
  SITE_ANALYTICS_VISITOR_COOKIE,
  isSiteAnalyticsBotUserAgent,
  parseSiteAnalyticsIngestBody,
} from "@/lib/site-analytics-shared";
export type {
  AdminTrafficDayPoint,
  AdminTrafficSnapshot,
  AdminTrafficTopLink,
  AdminTrafficTopPage,
  SiteAnalyticsIngestPayload,
  SiteAnalyticsKind,
} from "@/lib/site-analytics-shared";

type CountRow = { n: bigint };
type TopPageRow = { path: string; views: bigint };
type TopLinkRow = { target: string; label: string | null; clicks: bigint };
type DayRow = { day_key: string; page_views: bigint; unique_visitors: bigint };
type RecentRow = {
  created_at: Date;
  kind: string;
  path: string;
  target_path: string | null;
  target_url: string | null;
  link_label: string | null;
};

const EMPTY_TRAFFIC: AdminTrafficSnapshot = {
  windowDays: 7,
  pageViews: 0,
  uniqueVisitors: 0,
  linkClicks: 0,
  topPages: [],
  topLinks: [],
  daily: [],
  recentEvents: [],
};

export async function recordSiteAnalyticsEvent(
  payload: SiteAnalyticsIngestPayload,
): Promise<void> {
  await prisma.siteAnalyticsEvent.create({
    data: {
      kind: payload.kind,
      path: payload.path,
      targetPath: payload.targetPath ?? null,
      targetUrl: payload.targetUrl ?? null,
      linkLabel: payload.linkLabel ?? null,
      visitorId: payload.visitorId,
      sessionId: payload.sessionId,
      utmSource: payload.utmSource ?? null,
      utmMedium: payload.utmMedium ?? null,
      utmCampaign: payload.utmCampaign ?? null,
      utmContent: payload.utmContent ?? null,
      utmTerm: payload.utmTerm ?? null,
    },
  });
}

export async function getAdminSiteTrafficSnapshot(windowDays = 7): Promise<AdminTrafficSnapshot> {
  const days = Math.min(30, Math.max(1, Math.floor(windowDays)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const [pageViewsRow, visitorsRow, linkClicksRow, topPages, topLinks, daily, recent] =
      await Promise.all([
        prisma.$queryRaw<CountRow[]>`
          SELECT COUNT(*)::bigint AS n
          FROM site_analytics_events
          WHERE "createdAt" >= ${since} AND kind = 'PAGE_VIEW'
        `,
        prisma.$queryRaw<CountRow[]>`
          SELECT COUNT(DISTINCT "visitorId")::bigint AS n
          FROM site_analytics_events
          WHERE "createdAt" >= ${since} AND kind = 'PAGE_VIEW'
        `,
        prisma.$queryRaw<CountRow[]>`
          SELECT COUNT(*)::bigint AS n
          FROM site_analytics_events
          WHERE "createdAt" >= ${since} AND kind = 'LINK_CLICK'
        `,
        prisma.$queryRaw<TopPageRow[]>`
          SELECT path, COUNT(*)::bigint AS views
          FROM site_analytics_events
          WHERE "createdAt" >= ${since} AND kind = 'PAGE_VIEW'
          GROUP BY path
          ORDER BY views DESC
          LIMIT 12
        `,
        prisma.$queryRaw<TopLinkRow[]>`
          SELECT
            COALESCE("targetPath", "targetUrl", '(unknown)') AS target,
            MAX("linkLabel") AS label,
            COUNT(*)::bigint AS clicks
          FROM site_analytics_events
          WHERE "createdAt" >= ${since} AND kind = 'LINK_CLICK'
          GROUP BY COALESCE("targetPath", "targetUrl", '(unknown)')
          ORDER BY clicks DESC
          LIMIT 12
        `,
        prisma.$queryRaw<DayRow[]>`
          SELECT
            to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day_key,
            COUNT(*) FILTER (WHERE kind = 'PAGE_VIEW')::bigint AS page_views,
            COUNT(DISTINCT "visitorId") FILTER (WHERE kind = 'PAGE_VIEW')::bigint AS unique_visitors
          FROM site_analytics_events
          WHERE "createdAt" >= ${since}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
        prisma.$queryRaw<RecentRow[]>`
          SELECT
            "createdAt" AS created_at,
            kind,
            path,
            "targetPath" AS target_path,
            "targetUrl" AS target_url,
            "linkLabel" AS link_label
          FROM site_analytics_events
          ORDER BY "createdAt" DESC
          LIMIT 20
        `,
      ]);

    return {
      windowDays: days,
      pageViews: Number(pageViewsRow[0]?.n ?? BigInt(0)),
      uniqueVisitors: Number(visitorsRow[0]?.n ?? BigInt(0)),
      linkClicks: Number(linkClicksRow[0]?.n ?? BigInt(0)),
      topPages: topPages.map((r) => ({ path: r.path, views: Number(r.views) })),
      topLinks: topLinks.map((r) => ({
        target: r.target,
        label: r.label,
        clicks: Number(r.clicks),
      })),
      daily: daily.map((r) => ({
        dayKey: r.day_key,
        pageViews: Number(r.page_views),
        uniqueVisitors: Number(r.unique_visitors),
      })),
      recentEvents: recent.map((r) => ({
        at: r.created_at.toISOString(),
        kind: r.kind as SiteAnalyticsKind,
        path: r.path,
        target: r.target_path ?? r.target_url,
        label: r.link_label,
      })),
    };
  } catch (e) {
    if (isPrismaMissingTableError(e, "site_analytics_events")) {
      return { ...EMPTY_TRAFFIC, windowDays: days };
    }
    throw e;
  }
}
