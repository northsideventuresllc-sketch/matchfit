#!/usr/bin/env node
/**
 * Push MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID to Vercel (matchfit project) via REST API.
 * Requires VERCEL_TOKEN (personal/team token from vercel.com/account/tokens).
 *
 * Usage:
 *   VERCEL_TOKEN=... MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID=price_... node scripts/vercel-env-set-client-vip-price.mjs
 *   VERCEL_TOKEN=... node scripts/vercel-env-set-client-vip-price.mjs --from-secrets-file
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const teamId = "team_dD8iOW15WOUr27k3QeswFBac";
const projectIds = ["matchfit"];
const ENV_KEY = "MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID";

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

function loadPriceId() {
  let priceId = process.env[ENV_KEY]?.trim() ?? "";

  if (process.argv.includes("--from-secrets-file")) {
    for (const file of [".beta-launch-secrets.local", ".env"]) {
      const p = resolve(root, file);
      if (!existsSync(p)) continue;
      const fromFile = parseEnv(readFileSync(p, "utf8")).get(ENV_KEY)?.trim();
      if (fromFile) {
        priceId = fromFile;
        break;
      }
    }
  }

  if (!priceId.startsWith("price_")) {
    console.error(`${ENV_KEY} must be set (price_...). Run: npm run stripe:setup:client-vip`);
    process.exit(1);
  }
  return priceId;
}

async function upsertEnv(projectId, key, value, token, targets) {
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
      target: targets,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to set ${key}: HTTP ${res.status} ${body.slice(0, 240)}`);
  }
  console.log(`Set ${key} on ${projectId} (${targets.join(", ")})`);
}

async function main() {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    console.error("VERCEL_TOKEN is required. Create one at https://vercel.com/account/tokens");
    process.exit(1);
  }

  const priceId = loadPriceId();
  for (const projectId of projectIds) {
    for (const targets of [["production"], ["preview"]]) {
      await upsertEnv(projectId, ENV_KEY, priceId, token, targets);
    }
  }

  console.log("Done. No redeploy required — server routes pick up encrypted env vars on next invocation.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
