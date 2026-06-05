#!/usr/bin/env node
/**
 * Push live Stripe keys to Vercel production (matchfit project) via REST API.
 * Requires VERCEL_TOKEN (personal/team token from vercel.com/account/tokens).
 *
 * Usage:
 *   VERCEL_TOKEN=... node scripts/vercel-env-set-stripe-production.mjs
 *   VERCEL_TOKEN=... node scripts/vercel-env-set-stripe-production.mjs --from-secrets-file
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const teamId = "team_dD8iOW15WOUr27k3QeswFBac";
const projectId = "matchfit";

const ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
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

function loadValues() {
  const map = new Map();
  for (const key of ENV_KEYS) {
    const fromEnv = process.env[key]?.trim();
    if (fromEnv) map.set(key, fromEnv);
  }

  if (process.argv.includes("--from-secrets-file")) {
    const secretsPath = resolve(root, ".beta-launch-secrets.local");
    if (!existsSync(secretsPath)) {
      console.error("Missing .beta-launch-secrets.local");
      process.exit(1);
    }
    for (const [k, v] of parseEnv(readFileSync(secretsPath, "utf8"))) {
      if (ENV_KEYS.includes(k) && v?.trim()) map.set(k, v.trim());
    }
  }

  const secret = map.get("STRIPE_SECRET_KEY") ?? "";
  const publishable = map.get("STRIPE_PUBLISHABLE_KEY") ?? map.get("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY") ?? "";
  if (!secret.startsWith("sk_live_") && !secret.startsWith("sk_test_")) {
    console.error("STRIPE_SECRET_KEY must be set (sk_live_... or sk_test_...).");
    process.exit(1);
  }
  if (!publishable.startsWith("pk_live_") && !publishable.startsWith("pk_test_")) {
    console.error("STRIPE_PUBLISHABLE_KEY must be set (pk_live_... or pk_test_...).");
    process.exit(1);
  }
  map.set("STRIPE_PUBLISHABLE_KEY", publishable);
  map.set("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", publishable);

  const webhook = map.get("STRIPE_WEBHOOK_SECRET") ?? "";
  if (!webhook.startsWith("whsec_")) {
    console.error("STRIPE_WEBHOOK_SECRET must be set (whsec_...).");
    process.exit(1);
  }

  return map;
}

async function upsertEnv(key, value, token) {
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
      target: ["production"],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to set ${key}: HTTP ${res.status} ${body.slice(0, 240)}`);
  }
  console.log(`Set ${key} (production)`);
}

async function main() {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    console.error("VERCEL_TOKEN is required. Create one at https://vercel.com/account/tokens");
    process.exit(1);
  }

  const values = loadValues();
  for (const key of ENV_KEYS) {
    await upsertEnv(key, values.get(key), token);
  }

  console.log("Done. Redeploy production so NEXT_PUBLIC_* is baked into client bundles (STRIPE_PUBLISHABLE_KEY works without redeploy).");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
