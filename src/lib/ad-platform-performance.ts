import "server-only";

import type { AdPlatform } from "@/lib/ad-tracking-config";
import { googleAdsConversionSendTo } from "@/lib/google-ads";
import { withMetaGraphAuth } from "@/lib/meta-graph";
import { isPrismaMissingColumnError, isPrismaMissingTableError } from "@/lib/prisma-missing-column";
import { prisma } from "@/lib/prisma";

/** Meta Marketing API Graph version used for Insights spend sync. */
export const META_ADS_GRAPH_VERSION = "v21.0";

export type AdPlatformSpendSyncStatus =
  | "not_configured"
  | "credentials_present"
  | "insights_ok"
  | "insights_error";

export type AdPlatformIntegrationStatus = {
  platform: AdPlatform;
  /** True when required env vars are set — not proof that spend Insights works. */
  configured: boolean;
  missingEnv: string[];
  /**
   * Spend sync readiness. For Meta, `insights_ok` only after Insights returns costs
   * (System User needs `ads_read` on the correct `act_` ad account). Env alone is
   * `credentials_present`.
   */
  spendSyncStatus: AdPlatformSpendSyncStatus;
  /** Operator-facing detail (account id display, Insights error). Never includes tokens. */
  spendSyncDetail: string | null;
};

export type MetaCapiSyncStatus = "not_configured" | "credentials_present" | "capi_ok" | "capi_error";

export type ServerConversionIntegrationStatus = {
  metaCapi: {
    /** Env present (pixel + CAPI token or ads-token fallback) — not proof Meta accepted events. */
    configured: boolean;
    missingEnv: string[];
    /** Live CAPI readiness. `capi_ok` only after Graph accepts a probe event. */
    capiSyncStatus: MetaCapiSyncStatus;
    capiSyncDetail: string | null;
    usedAdsTokenFallback: boolean;
  };
  ga4: { configured: boolean; missingEnv: string[] };
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
    tiktok: { impressions: number; clicks: number; spendCents: number; conversions: number };
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

/** Normalize Meta ad account id to digits + `act_` form (accepts either). */
export function normalizeMetaAdAccountId(raw: string): { numericId: string; actId: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const numericId = trimmed.replace(/^act_/i, "").replace(/\s+/g, "");
  if (!/^\d{5,20}$/.test(numericId)) return null;
  return { numericId, actId: `act_${numericId}` };
}

export function formatMetaInsightsOperatorError(message: string): string {
  const base = message.trim() || "Meta Insights request failed.";
  const lower = base.toLowerCase();
  if (lower.includes("api access blocked") || lower.includes("access_denied")) {
    return (
      `${base} Token Debugger can still show Valid + ads_read while Graph returns access_denied. ` +
      `Fix on Match Fit app (id 1326626849446738): (1) App Dashboard → add Marketing API product if missing. ` +
      `(2) Settings → Advanced → Security → turn OFF “Require App Secret”, OR set META_APP_SECRET so server sends appsecret_proof. ` +
      `(3) Business Settings → System User assigned to act_ ad account. One ad account is fine — Sync uses META_AD_ACCOUNT_ID only.`
    );
  }
  if (
    lower.includes("ads_read") ||
    lower.includes("permission") ||
    lower.includes("(#100)") ||
    lower.includes("(#200)") ||
    lower.includes("does not have permission") ||
    lower.includes("missing permission") ||
    lower.includes("appsecret_proof")
  ) {
    return (
      `${base} Use a Meta Business System User token with ads_read on META_AD_ACCOUNT_ID (act_…). ` +
      `If App requires App Secret, set META_APP_SECRET (Settings → Basic). Env present alone is not enough — Insights must return spend.`
    );
  }
  if (lower.includes("invalid") && (lower.includes("account") || lower.includes("act_"))) {
    return (
      `${base} Check META_AD_ACCOUNT_ID matches the Ads Manager account that is actually spending ` +
      `(act_… form or digits). Pixel/CAPI tokens are separate from ads Insights.`
    );
  }
  return base;
}

export function getAdPlatformIntegrationStatus(options?: {
  metaInsights?: { ok: boolean; detail: string | null } | null;
}): AdPlatformIntegrationStatus[] {
  const metaMissing: string[] = [];
  if (!process.env.META_ADS_ACCESS_TOKEN?.trim()) metaMissing.push("META_ADS_ACCESS_TOKEN");
  if (!process.env.META_AD_ACCOUNT_ID?.trim()) metaMissing.push("META_AD_ACCOUNT_ID");

  const googleMissing: string[] = [];
  if (!process.env.GOOGLE_ADS_CUSTOMER_ID?.trim()) googleMissing.push("GOOGLE_ADS_CUSTOMER_ID");
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()) googleMissing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim()) googleMissing.push("GOOGLE_ADS_REFRESH_TOKEN");
  if (!process.env.GOOGLE_ADS_CLIENT_ID?.trim()) googleMissing.push("GOOGLE_ADS_CLIENT_ID");
  if (!process.env.GOOGLE_ADS_CLIENT_SECRET?.trim()) googleMissing.push("GOOGLE_ADS_CLIENT_SECRET");

  const tiktokMissing: string[] = [];
  if (!process.env.TIKTOK_ADS_ACCESS_TOKEN?.trim()) tiktokMissing.push("TIKTOK_ADS_ACCESS_TOKEN");
  if (!process.env.TIKTOK_ADS_ADVERTISER_ID?.trim()) tiktokMissing.push("TIKTOK_ADS_ADVERTISER_ID");

  const metaConfigured = metaMissing.length === 0;
  const metaAccount = process.env.META_AD_ACCOUNT_ID?.trim()
    ? normalizeMetaAdAccountId(process.env.META_AD_ACCOUNT_ID)
    : null;
  let metaSpend: AdPlatformSpendSyncStatus = "not_configured";
  let metaDetail: string | null = null;
  if (metaConfigured) {
    if (options?.metaInsights?.ok) {
      metaSpend = "insights_ok";
      metaDetail =
        options.metaInsights.detail ??
        (metaAccount
          ? `Insights OK for ${metaAccount.actId} (spend sync ready).`
          : "Insights OK (spend sync ready).");
    } else if (options?.metaInsights && !options.metaInsights.ok) {
      metaSpend = "insights_error";
      metaDetail = options.metaInsights.detail;
    } else {
      metaSpend = "credentials_present";
      metaDetail = metaAccount
        ? `Credentials set for ${metaAccount.actId}. Run Sync now — Insights must return costs (System User ads_read).`
        : "Credentials set. Run Sync now — Insights must return costs (System User ads_read). Check META_AD_ACCOUNT_ID format (act_…).";
    }
  }

  const envOnlyStatus = (configured: boolean): Pick<
    AdPlatformIntegrationStatus,
    "spendSyncStatus" | "spendSyncDetail"
  > =>
    configured
      ? {
          spendSyncStatus: "credentials_present",
          spendSyncDetail: "Credentials set. Sync to confirm spend reporting.",
        }
      : { spendSyncStatus: "not_configured", spendSyncDetail: null };

  return [
    {
      platform: "meta",
      configured: metaConfigured,
      missingEnv: metaMissing,
      spendSyncStatus: metaSpend,
      spendSyncDetail: metaDetail,
    },
    {
      platform: "google",
      configured: googleMissing.length === 0,
      missingEnv: googleMissing,
      ...envOnlyStatus(googleMissing.length === 0),
    },
    {
      platform: "tiktok",
      configured: tiktokMissing.length === 0,
      missingEnv: tiktokMissing,
      ...envOnlyStatus(tiktokMissing.length === 0),
    },
  ];
}

export function getServerConversionIntegrationStatus(opts?: {
  metaCapiProbe?: { ok: boolean; detail: string; usedAdsTokenFallback?: boolean } | null;
}): ServerConversionIntegrationStatus {
  const metaMissing: string[] = [];
  if (!process.env.META_PIXEL_ID?.trim()) metaMissing.push("META_PIXEL_ID");
  const hasDedicatedCapi = Boolean(process.env.META_ACCESS_TOKEN?.trim());
  const hasAdsFallback = Boolean(process.env.META_ADS_ACCESS_TOKEN?.trim());
  if (!hasDedicatedCapi && !hasAdsFallback) metaMissing.push("META_ACCESS_TOKEN");

  const configured = metaMissing.length === 0;
  const probe = opts?.metaCapiProbe;
  let capiSyncStatus: MetaCapiSyncStatus = "not_configured";
  let capiSyncDetail: string | null = null;
  let usedAdsTokenFallback = Boolean(probe?.usedAdsTokenFallback) || (!hasDedicatedCapi && hasAdsFallback);

  if (!configured) {
    capiSyncStatus = "not_configured";
    capiSyncDetail = "Add META_PIXEL_ID and META_ACCESS_TOKEN (Conversions API system user token from Events Manager).";
  } else if (probe == null) {
    capiSyncStatus = "credentials_present";
    capiSyncDetail = usedAdsTokenFallback
      ? "Credentials set (META_ADS_ACCESS_TOKEN fallback). Run Ad Tracking HQ load for a live CAPI probe."
      : "Credentials set. Run Ad Tracking HQ load for a live CAPI probe.";
  } else if (probe.ok) {
    capiSyncStatus = "capi_ok";
    capiSyncDetail = probe.detail;
    usedAdsTokenFallback = Boolean(probe.usedAdsTokenFallback) || usedAdsTokenFallback;
  } else {
    capiSyncStatus = "capi_error";
    capiSyncDetail = probe.detail;
    usedAdsTokenFallback = Boolean(probe.usedAdsTokenFallback) || usedAdsTokenFallback;
  }

  const gaMissing: string[] = [];
  if (!process.env.GA_MEASUREMENT_ID?.trim()) gaMissing.push("GA_MEASUREMENT_ID");
  if (!process.env.GA_API_SECRET?.trim()) gaMissing.push("GA_API_SECRET");

  return {
    metaCapi: {
      configured,
      missingEnv: metaMissing,
      capiSyncStatus,
      capiSyncDetail,
      usedAdsTokenFallback,
    },
    ga4: { configured: gaMissing.length === 0, missingEnv: gaMissing },
  };
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

type MetaInsightsRow = {
  impressions?: string;
  clicks?: string;
  spend?: string;
  actions?: unknown;
  date_start?: string;
  date_stop?: string;
};

type MetaInsightsResponse = {
  data?: MetaInsightsRow[];
  error?: { message?: string; code?: number; type?: string; error_user_msg?: string };
};

function metaInsightsUrl(actId: string, dayKey: string, token: string): URL {
  const timeRange = JSON.stringify({ since: dayKey, until: dayKey });
  const url = new URL(`https://graph.facebook.com/${META_ADS_GRAPH_VERSION}/${actId}/insights`);
  url.searchParams.set("fields", "impressions,clicks,spend,actions");
  url.searchParams.set("time_range", timeRange);
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("level", "account");
  return withMetaGraphAuth(url, token);
}

/**
 * Probes Marketing API Insights for spend (not just account metadata).
 * Account `GET /act_…` succeeding is insufficient — System User needs `ads_read`.
 */
export async function probeMetaInsightsAccess(dayKey = easternDayKey()): Promise<{
  ok: boolean;
  actId: string | null;
  spendCents: number | null;
  detail: string;
}> {
  const token = process.env.META_ADS_ACCESS_TOKEN?.trim();
  const accountRaw = process.env.META_AD_ACCOUNT_ID?.trim();
  if (!token || !accountRaw) {
    return {
      ok: false,
      actId: null,
      spendCents: null,
      detail: "META_ADS_ACCESS_TOKEN and META_AD_ACCOUNT_ID are required for Insights spend sync.",
    };
  }

  const account = normalizeMetaAdAccountId(accountRaw);
  if (!account) {
    return {
      ok: false,
      actId: null,
      spendCents: null,
      detail: formatMetaInsightsOperatorError(
        `Invalid META_AD_ACCOUNT_ID "${accountRaw}". Use the Ads Manager act_… id (digits or act_ prefix).`,
      ),
    };
  }

  const url = metaInsightsUrl(account.actId, dayKey, token);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as MetaInsightsResponse;

  if (!res.ok || json.error) {
    const msg = json.error?.message ?? json.error?.error_user_msg ?? `Meta insights HTTP ${res.status}`;
    return {
      ok: false,
      actId: account.actId,
      spendCents: null,
      detail: formatMetaInsightsOperatorError(msg),
    };
  }

  // Empty data for a quiet day is still a successful Insights read (spend = 0).
  const row = json.data?.[0];
  const spendUsd = Number.parseFloat(row?.spend ?? "0") || 0;
  const spendCents = Math.round(spendUsd * 100);

  return {
    ok: true,
    actId: account.actId,
    spendCents,
    detail: `Insights returned costs for ${account.actId} on ${dayKey} (spend $${(spendCents / 100).toFixed(2)}).`,
  };
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

  const account = normalizeMetaAdAccountId(accountRaw);
  if (!account) {
    throw new Error(
      formatMetaInsightsOperatorError(
        `Invalid META_AD_ACCOUNT_ID "${accountRaw}". Use the Ads Manager act_… id (digits or act_ prefix).`,
      ),
    );
  }

  const url = metaInsightsUrl(account.actId, dayKey, token);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as MetaInsightsResponse;

  if (!res.ok || json.error) {
    const msg = json.error?.message ?? json.error?.error_user_msg ?? `Meta insights HTTP ${res.status}`;
    throw new Error(formatMetaInsightsOperatorError(msg));
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
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim()?.replace(/-/g, "");
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!customerId || !developerToken) return null;

  const accessToken = await getGoogleAdsAccessToken();
  if (!accessToken) return null;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId;
  }

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
      headers,
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

export async function fetchTikTokAdsDailySnapshot(dayKey: string): Promise<{
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  rawJson: string;
} | null> {
  const accessToken = process.env.TIKTOK_ADS_ACCESS_TOKEN?.trim();
  const advertiserId = process.env.TIKTOK_ADS_ADVERTISER_ID?.trim();
  if (!accessToken || !advertiserId) return null;

  const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/", {
    method: "POST",
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      advertiser_id: advertiserId,
      service_type: "AUCTION",
      report_type: "BASIC",
      data_level: "AUCTION_ADVERTISER",
      dimensions: ["stat_time_day"],
      metrics: ["spend", "impressions", "clicks", "conversion"],
      start_date: dayKey,
      end_date: dayKey,
      page: 1,
      page_size: 1,
    }),
    cache: "no-store",
  });

  const json = (await res.json()) as {
    code?: number;
    message?: string;
    data?: {
      list?: Array<{
        metrics?: {
          spend?: string;
          impressions?: string;
          clicks?: string;
          conversion?: string;
        };
      }>;
    };
  };

  if (!res.ok || json.code !== 0) {
    throw new Error(json.message ?? `TikTok Ads API HTTP ${res.status}`);
  }

  const metrics = json.data?.list?.[0]?.metrics;
  const spendUsd = Number.parseFloat(metrics?.spend ?? "0") || 0;

  return {
    impressions: Number.parseInt(metrics?.impressions ?? "0", 10) || 0,
    clicks: Number.parseInt(metrics?.clicks ?? "0", 10) || 0,
    spendCents: Math.round(spendUsd * 100),
    conversions: Number.parseInt(metrics?.conversion ?? "0", 10) || 0,
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

    try {
      const tiktok = await fetchTikTokAdsDailySnapshot(dayKey);
      if (tiktok) {
        await upsertAdPlatformSnapshot("tiktok", dayKey, tiktok);
        if (!synced.includes("tiktok")) synced.push("tiktok");
      }
    } catch (e) {
      errors.tiktok = e instanceof Error ? e.message : "TikTok sync failed.";
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

  let metaInsights: { ok: boolean; detail: string | null } | null = null;
  if (process.env.META_ADS_ACCESS_TOKEN?.trim() && process.env.META_AD_ACCOUNT_ID?.trim()) {
    try {
      const probe = await probeMetaInsightsAccess(daysAgoEastern(1));
      metaInsights = { ok: probe.ok, detail: probe.detail };
    } catch (e) {
      metaInsights = {
        ok: false,
        detail: formatMetaInsightsOperatorError(
          e instanceof Error ? e.message : "Meta Insights probe failed.",
        ),
      };
    }
  }

  return {
    windowDays: days,
    integrations: getAdPlatformIntegrationStatus({ metaInsights }),
    googleConversionLabels: {
      clientSignup: googleAdsConversionSendTo("client_signup"),
      trainerSignup: googleAdsConversionSendTo("trainer_signup"),
    },
    platformDaily,
    attribution,
    totals: {
      meta: sumPlatform("meta"),
      google: sumPlatform("google"),
      tiktok: sumPlatform("tiktok"),
      attributedPageViews,
      attributedSignupViews,
    },
  };
}
