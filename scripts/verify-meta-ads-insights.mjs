#!/usr/bin/env node
/**
 * Verify Meta Marketing API Insights can return spend for Match Fit Ad Tracker.
 *
 * Account metadata (GET /act_…) is NOT enough. Requires:
 * - META_ADS_ACCESS_TOKEN: Business System User token with ads_read
 * - META_AD_ACCOUNT_ID: correct Ads Manager account (digits or act_…)
 *
 * Usage:
 *   node --env-file=.env scripts/verify-meta-ads-insights.mjs
 *   META_ADS_ACCESS_TOKEN=… META_AD_ACCOUNT_ID=act_… node scripts/verify-meta-ads-insights.mjs
 */
const token = process.env.META_ADS_ACCESS_TOKEN?.trim();
const accountRaw = process.env.META_AD_ACCOUNT_ID?.trim();

if (!token || !accountRaw) {
  console.error("Set META_ADS_ACCESS_TOKEN and META_AD_ACCOUNT_ID.");
  process.exit(1);
}

const numericId = accountRaw.replace(/^act_/i, "").replace(/\s+/g, "");
if (!/^\d{5,20}$/.test(numericId)) {
  console.error(`Invalid META_AD_ACCOUNT_ID "${accountRaw}". Use digits or act_… from Ads Manager.`);
  process.exit(1);
}

const actId = `act_${numericId}`;
const since = new Date();
since.setUTCDate(since.getUTCDate() - 1);
const dayKey = since.toISOString().slice(0, 10);
const timeRange = JSON.stringify({ since: dayKey, until: dayKey });

const url = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
url.searchParams.set("fields", "impressions,clicks,spend");
url.searchParams.set("time_range", timeRange);
url.searchParams.set("time_increment", "1");
url.searchParams.set("level", "account");
url.searchParams.set("access_token", token);

const res = await fetch(url.toString(), { cache: "no-store" });
const json = await res.json();

if (!res.ok || json.error) {
  const msg = json.error?.message ?? `HTTP ${res.status}`;
  console.error(`Meta Insights failed for ${actId}: ${msg}`);
  console.error(
    "Fix: System User token with ads_read assigned to this ad account. “API connected” / env alone is not enough.",
  );
  process.exit(1);
}

const row = json.data?.[0] ?? {};
console.log(
  JSON.stringify(
    {
      ok: true,
      actId,
      dayKey,
      impressions: row.impressions ?? "0",
      clicks: row.clicks ?? "0",
      spend: row.spend ?? "0",
      note: "Insights returned costs (spend may be 0 on quiet days).",
    },
    null,
    2,
  ),
);
