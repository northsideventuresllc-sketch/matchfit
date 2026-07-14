#!/usr/bin/env node
/**
 * Push Meta / Google Ads API keys to Vercel production (matchfit project) via REST API.
 * Requires VERCEL_TOKEN (personal/team token from vercel.com/account/tokens).
 *
 * Usage:
 *   VERCEL_TOKEN=... META_ADS_ACCESS_TOKEN=... META_AD_ACCOUNT_ID=... \
 *     GOOGLE_ADS_CUSTOMER_ID=5315329090 GOOGLE_ADS_LOGIN_CUSTOMER_ID=6784420909 \
 *     node scripts/vercel-env-set-ad-platform-production.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const teamId = "team_dD8iOW15WOUr27k3QeswFBac";
const DEFAULT_PROJECT_ID = "matchfit";

const ENV_KEYS = [
  "META_ADS_ACCESS_TOKEN",
  "META_AD_ACCOUNT_ID",
  "GOOGLE_ADS_CUSTOMER_ID",
  "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "META_PIXEL_ID",
  "META_ACCESS_TOKEN",
  "GA_MEASUREMENT_ID",
  "GA_API_SECRET",
  "TIKTOK_ADS_ACCESS_TOKEN",
  "TIKTOK_ADS_ADVERTISER_ID",
];

function parseEnv(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

function resolveProjectId() {
  const projectFlag = process.argv.indexOf("--project");
  if (projectFlag !== -1 && process.argv[projectFlag + 1]) {
    return process.argv[projectFlag + 1].trim();
  }
  return DEFAULT_PROJECT_ID;
}

function normalizeCustomerId(raw) {
  return raw?.trim()?.replace(/-/g, "") ?? "";
}

function loadValues() {
  const map = new Map();
  for (const key of ENV_KEYS) {
    const fromEnv = process.env[key]?.trim();
    if (fromEnv) map.set(key, fromEnv);
  }

  const envPath = resolve(root, ".env");
  if (existsSync(envPath)) {
    for (const [k, v] of parseEnv(readFileSync(envPath, "utf8"))) {
      if (ENV_KEYS.includes(k) && v?.trim() && !map.has(k)) map.set(k, v.trim());
    }
  }

  const metaToken = map.get("META_ADS_ACCESS_TOKEN") ?? "";
  const metaAccount = map.get("META_AD_ACCOUNT_ID") ?? "";
  if (metaToken && !metaAccount) {
    console.error("META_AD_ACCOUNT_ID is required when META_ADS_ACCESS_TOKEN is set.");
    process.exit(1);
  }
  if (metaAccount && !metaToken) {
    console.error("META_ADS_ACCESS_TOKEN is required when META_AD_ACCOUNT_ID is set.");
    process.exit(1);
  }

  if (map.size === 0) {
    console.error("No ad platform env values found in process.env or .env.");
    process.exit(1);
  }

  if (map.has("GOOGLE_ADS_CUSTOMER_ID")) {
    map.set("GOOGLE_ADS_CUSTOMER_ID", normalizeCustomerId(map.get("GOOGLE_ADS_CUSTOMER_ID")));
  }
  if (map.has("GOOGLE_ADS_LOGIN_CUSTOMER_ID")) {
    map.set("GOOGLE_ADS_LOGIN_CUSTOMER_ID", normalizeCustomerId(map.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID")));
  }

  return map;
}

async function upsertEnv(projectId, key, value, token) {
  const url = new URL(`https://api.vercel.com/v10/projects/${projectId}/env`);
  url.searchParams.set("upsert", "true");
  url.searchParams.set("teamId", teamId);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      value,
      type: "encrypted",
      target: ["production", "preview"],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to set ${key} on ${projectId}: HTTP ${res.status} ${body.slice(0, 240)}`);
  }
  console.log(`Set ${key} (production + preview) on ${projectId}`);
}

async function verifyMetaInsights(token, accountId) {
  const account = accountId.replace(/^act_/i, "").replace(/\s+/g, "");
  if (!/^\d{5,20}$/.test(account)) {
    throw new Error(
      `Invalid META_AD_ACCOUNT_ID "${accountId}". Use Ads Manager digits or act_… form.`,
    );
  }

  // Account metadata alone is NOT enough — Insights must return costs (ads_read).
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 1);
  const dayKey = since.toISOString().slice(0, 10);
  const timeRange = JSON.stringify({ since: dayKey, until: dayKey });
  const url = new URL(`https://graph.facebook.com/v21.0/act_${account}/insights`);
  url.searchParams.set("fields", "impressions,clicks,spend");
  url.searchParams.set("time_range", timeRange);
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("level", "account");
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `Meta Insights probe failed HTTP ${res.status}`;
    throw new Error(
      `${msg} — System User token needs ads_read on act_${account}. Env present / account GET is not enough.`,
    );
  }

  const spend = json.data?.[0]?.spend ?? "0";
  console.log(
    `Verified Meta Insights for act_${account} on ${dayKey} (spend=${spend}). Credentials alone are not enough — Insights returned costs.`,
  );
}

async function main() {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    console.error("VERCEL_TOKEN is required. Create one at https://vercel.com/account/tokens");
    process.exit(1);
  }

  const projectId = resolveProjectId();
  const values = loadValues();

  const metaToken = values.get("META_ADS_ACCESS_TOKEN");
  const metaAccount = values.get("META_AD_ACCOUNT_ID");
  if (metaToken && metaAccount) {
    await verifyMetaInsights(metaToken, metaAccount);
  }

  for (const key of ENV_KEYS) {
    const value = values.get(key);
    if (!value) continue;
    await upsertEnv(projectId, key, value, token);
  }

  console.log(`Done (${projectId}). Redeploy for env changes to apply to new builds.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
