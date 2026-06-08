import "server-only";

import type { AdPlatform } from "@/lib/ad-tracking-config";
import { googleAdsConversionSendTo } from "@/lib/google-ads";
import { isPrismaMissingColumnError, isPrismaMissingTableError } from "@/lib/prisma-missing-column";
import { prisma } from "@/lib/prisma";

export type AdPlatformIntegrationStatus = {
  platform: AdPlatform;
  configured: boolean;
  missingEnv: string[];
};

export type AdPlatformDailyMetrics = {
  platform: AdPlatform;
  dayKey: string;
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  syncedAt: string | null;
};

export type AdAttributionCampaignRow = {
  utmSource: string;
  utmMedium: string | null;
  utmCampaign: string;
  pageViews: number;
  uniqueVisitors: number;
  signupPageViews: number;
};

export type AdPerformancePanel = {
  windowDays: number;
  integrations: AdPlatformIntegrationStatus[];
  googleConversionLabels: {
    clientSignup: string | null;
    trainerSignup: string | null;
  };
  platformDaily: AdPlatformDailyMetrics[];
  attribution: AdAttributionCampaignRow[];
  totals: {
    meta: { impressions: number; clicks: number; spendCents: number; conversions: number };
    google: { impressions: number; clicks: number; spendCents: number; conversions: number };
    attributedPageViews: number;
    attributedSignupViews: number;
  };
};

const SIGNUP_PATHS = [
  "/client/sign-up",
  "/client/sign-up/complete",
  "/trainer/signup",
  "/trainer/sign-up",
  "/trainer/signup/complete",
];

type CountRow = { n: bigint };
type AttributionRow = {
  utm_source: string;
  utm_medium: string | null;
  utm_campaign: string;
  page_views: bigint;
  unique_visitors: bigint;
  signup_views: bigint;
};

function easternDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function daysAgoEastern(dayCount: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dayCount);
  return easternDayKey(d);
}

export function getAdPlatformIntegrationStatus(): AdPlatformIntegrationStatus[] {
  const metaMissing: string[] = [];
  if (!process.env.META_ADS_ACCESS_TOKEN?.trim()) metaMissing.push("META_ADS_ACCESS_TOKEN");
  if (!process.env.META_AD_ACCOUNT_ID?.trim()) metaMissing.push("META_AD_ACCOUNT_ID");

  const googleMissing: string[] = [];
  if (!process.env.GOOGLE_ADS_CUSTOMER_ID?.trim()) googleMissing.push("GOOGLE_ADS_CUSTOMER_ID");
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()) googleMissing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim()) googleMissing.push("GOOGLE_ADS_REFRESH_TOKEN");
  if (!process.env.GOOGLE_ADS_CLIENT_ID?.trim()) googleMissing.push("GOOGLE_ADS_CLIENT_ID");
  if (!process.env.GOOGLE_ADS_CLIENT_SECRET?.trim()) googleMissing.push("GOOGLE_ADS_CLIENT_SECRET");

  return [
    { platform: "meta", configured: metaMissing.length === 0, missingEnv: metaMissing },
    { platform: "google", configured: googleMissing.length === 0, missingEnv: googleMissing },
  ];
}

export function parseMetaConversions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  let total = 0;
  for (const action of actions) {
    if (!action || typeof action !== "object") continue;
    const row = action as { action_type?: string; value?: string };
    const type = row.action_type ?? "";
    if (
      type === "offsite_conversion.fb_pixel_subscribe" ||
      type === "offsite_conversion.fb_pixel_complete_registration" ||
      type === "lead" ||
      type === "subscribe" ||
      type === "complete_registration"
    ) {
      total += Number.parseInt(row.value ?? "0", 10) || 0;
    }
  }
  return total;
}

export async function fetchMetaDailySnapshot(dayKey: string): Promise<{
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  rawJson: string;
} | null> {
  const token = process.env.META_ADS_ACCESS_TOKEN?.trim();
  const accountRaw = process.env.META_AD_ACCOUNT_ID?.trim();
  if (!token || !accountRaw) return null;

  const accountId = accountRaw.replace(/^act_/, "");
  const timeRange = JSON.stringify({ since: dayKey, until: dayKey });
  const url = new URL(`https://graph.facebook.com/v21.0/act_${accountId}/insights`);
  url.searchParams.set("fields", "impressions,clicks,spend,actions");
  url.searchParams.set("time_range", timeRange);
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as {
    data?: Array<{
      impressions?: string;
      clicks?: string;
      spend?: string;
      actions?: unknown;
    }>;
    error?: { message?: string };
  };

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Meta insights HTTP ${res.status}`);
  }

  const row = json.data?.[0];
  const spendUsd = Number.parseFloat(row?.spend ?? "0") || 0;

  return {
    impressions: Number.parseInt(row?.impressions ?? "0", 10) || 0,
    clicks: Number.parseInt(row?.clicks ?? "0", 10) || 0,
    spendCents: Math.round(spendUsd * 100),
    conversions: parseMetaConversions(row?.actions),
    rawJson: JSON.stringify(json),
  };
}

async function getGoogleAdsAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const json = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error ?? `Google OAuth HTTP ${res.status}`);
  }
  return json.access_token;
}

export async function fetchGoogleAdsDailySnapshot(dayKey: string): Promise<{
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  rawJson: string;
} | null> {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID?.trim()?.replace(/-/g, "");
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!customerId || !developerToken) return null;

  const accessToken = await getGoogleAdsAccessToken();
  if (!accessToken) return null;

  const query = `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM customer
    WHERE segments.date = '${dayKey}'
  `;

  const res = await fetch(
    `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
    },
  );

  const json = (await res.json()) as {
    results?: Array<{
      metrics?: {
        impressions?: string;
        clicks?: string;
        costMicros?: string;
        conversions?: number;
      };
    }>;
    error?: { message?: string };
  };

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Google Ads API HTTP ${res.status}`);
  }

  const metrics = json.results?.[0]?.metrics;
  const costMicros = Number.parseInt(metrics?.costMicros ?? "0", 10) || 0;

  return {
    impressions: Number.parseInt(metrics?.impressions ?? "0", 10) || 0,
    clicks: Number.parseInt(metrics?.clicks ?? "0", 10) || 0,
    spendCents: Math.round(costMicros / 10_000),
    conversions: Math.round(Number(metrics?.conversions ?? 0)),
    rawJson: JSON.stringify(json),
  };
}

export async function upsertAdPlatformSnapshot(
  platform: AdPlatform,
  dayKey: string,
  metrics: {
    impressions: number;
    clicks: number;
    spendCents: number;
    conversions: number;
    rawJson?: string;
  },
): Promise<void> {
  await prisma.adPlatformDailySnapshot.upsert({
    where: { platform_dayKey: { platform, dayKey } },
    create: {
      platform,
      dayKey,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      spendCents: metrics.spendCents,
      conversions: metrics.conversions,
      rawJson: metrics.rawJson ?? null,
    },
    update: {
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      spendCents: metrics.spendCents,
      conversions: metrics.conversions,
      rawJson: metrics.rawJson ?? null,
    },
  });
}

export async function syncAdPlatformPerformance(days = 7): Promise<{
  synced: AdPlatform[];
  errors: Partial<Record<AdPlatform, string>>;
}> {
  const synced: AdPlatform[] = [];
  const errors: Partial<Record<AdPlatform, string>> = {};
  const dayCount = Math.min(30, Math.max(1, Math.floor(days)));

  for (let i = 0; i < dayCount; i++) {
    const dayKey = daysAgoEastern(i);

    try {
      const meta = await fetchMetaDailySnapshot(dayKey);
      if (meta) {
        await upsertAdPlatformSnapshot("meta", dayKey, meta);
        if (!synced.includes("meta")) synced.push("meta");
      }
    } catch (e) {
      errors.meta = e instanceof Error ? e.message : "Meta sync failed.";
    }

    try {
      const google = await fetchGoogleAdsDailySnapshot(dayKey);
      if (google) {
        await upsertAdPlatformSnapshot("google", dayKey, google);
        if (!synced.includes("google")) synced.push("google");
      }
    } catch (e) {
      errors.google = e instanceof Error ? e.message : "Google Ads sync failed.";
    }
  }

  return { synced, errors };
}

export async function getAdAttributionRows(windowDays = 7): Promise<AdAttributionCampaignRow[]> {
  const days = Math.min(30, Math.max(1, Math.floor(windowDays)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const rows = await prisma.$queryRaw<AttributionRow[]>`
      SELECT
        COALESCE("utmSource", 'direct') AS utm_source,
        "utmMedium" AS utm_medium,
        COALESCE("utmCampaign", '(none)') AS utm_campaign,
        COUNT(*) FILTER (WHERE kind = 'PAGE_VIEW')::bigint AS page_views,
        COUNT(DISTINCT "visitorId") FILTER (WHERE kind = 'PAGE_VIEW')::bigint AS unique_visitors,
        COUNT(*) FILTER (
          WHERE kind = 'PAGE_VIEW'
            AND path = ANY(${SIGNUP_PATHS})
        )::bigint AS signup_views
      FROM site_analytics_events
      WHERE "createdAt" >= ${since}
        AND ("utmSource" IS NOT NULL OR "utmCampaign" IS NOT NULL)
      GROUP BY 1, 2, 3
      ORDER BY page_views DESC
      LIMIT 25
    `;

    return rows.map((r) => ({
      utmSource: r.utm_source,
      utmMedium: r.utm_medium,
      utmCampaign: r.utm_campaign,
      pageViews: Number(r.page_views),
      uniqueVisitors: Number(r.unique_visitors),
      signupPageViews: Number(r.signup_views),
    }));
  } catch (e) {
    if (
      isPrismaMissingColumnError(e, "utmSource") ||
      isPrismaMissingTableError(e, "site_analytics_events")
    ) {
      return [];
    }
    throw e;
  }
}

export async function getAdPerformancePanel(windowDays = 7): Promise<AdPerformancePanel> {
  const days = Math.min(30, Math.max(1, Math.floor(windowDays)));
  const sinceDayKey = daysAgoEastern(days - 1);

  let platformDaily: AdPlatformDailyMetrics[] = [];
  try {
    const rows = await prisma.adPlatformDailySnapshot.findMany({
      where: { dayKey: { gte: sinceDayKey } },
      orderBy: [{ dayKey: "desc" }, { platform: "asc" }],
    });
    platformDaily = rows.map((r) => ({
      platform: r.platform as AdPlatform,
      dayKey: r.dayKey,
      impressions: r.impressions,
      clicks: r.clicks,
      spendCents: r.spendCents,
      conversions: r.conversions,
      syncedAt: r.updatedAt.toISOString(),
    }));
  } catch (e) {
    if (!isPrismaMissingTableError(e, "ad_platform_daily_snapshots")) throw e;
  }

  const attribution = await getAdAttributionRows(days);

  const sumPlatform = (platform: AdPlatform) =>
    platformDaily
      .filter((r) => r.platform === platform)
      .reduce(
        (acc, r) => ({
          impressions: acc.impressions + r.impressions,
          clicks: acc.clicks + r.clicks,
          spendCents: acc.spendCents + r.spendCents,
          conversions: acc.conversions + r.conversions,
        }),
        { impressions: 0, clicks: 0, spendCents: 0, conversions: 0 },
      );

  let attributedPageViews = 0;
  let attributedSignupViews = 0;
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [pvRow, signupRow] = await Promise.all([
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM site_analytics_events
        WHERE "createdAt" >= ${since} AND kind = 'PAGE_VIEW'
          AND ("utmSource" IS NOT NULL OR "utmCampaign" IS NOT NULL)
      `,
      prisma.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS n FROM site_analytics_events
        WHERE "createdAt" >= ${since} AND kind = 'PAGE_VIEW'
          AND path = ANY(${SIGNUP_PATHS})
          AND ("utmSource" IS NOT NULL OR "utmCampaign" IS NOT NULL)
      `,
    ]);
    attributedPageViews = Number(pvRow[0]?.n ?? 0);
    attributedSignupViews = Number(signupRow[0]?.n ?? 0);
  } catch (e) {
    if (!isPrismaMissingColumnError(e, "utmSource")) throw e;
  }

  return {
    windowDays: days,
    integrations: getAdPlatformIntegrationStatus(),
    googleConversionLabels: {
      clientSignup: googleAdsConversionSendTo("client_signup"),
      trainerSignup: googleAdsConversionSendTo("trainer_signup"),
    },
    platformDaily,
    attribution,
    totals: {
      meta: sumPlatform("meta"),
      google: sumPlatform("google"),
      attributedPageViews,
      attributedSignupViews,
    },
  };
}
