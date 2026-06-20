#!/usr/bin/env node
/**
 * Idempotently ensure Match Fit Client VIP Stripe product + $10/month price exist,
 * then write MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID to local env files.
 *
 * Requires STRIPE_SECRET_KEY (live or test — must match your deployment mode).
 *
 * Usage:
 *   node --env-file=.env scripts/setup-client-vip-stripe.mjs
 *   node --env-file=.env scripts/setup-client-vip-stripe.mjs --dry-run
 *   node --env-file=.env scripts/setup-client-vip-stripe.mjs --push-vercel
 */
import Stripe from "stripe";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const pushVercel = process.argv.includes("--push-vercel");

const LOOKUP_KEY = "match_fit_client_vip_monthly";
const UNIT_AMOUNT_CENTS = 1000; // Keep in sync with CLIENT_VIP_PRICE_USD in client-plan-access.ts
const PRODUCT_NAME = "Match Fit Client VIP";
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

function serializeEnv(map) {
  const lines = [];
  for (const [k, v] of map) {
    if (v === "") lines.push(`${k}=`);
    else if (/[\s#"]/.test(v)) lines.push(`${k}="${v.replace(/"/g, '\\"')}"`);
    else lines.push(`${k}=${v}`);
  }
  return `${lines.join("\n")}\n`;
}

function upsertEnvKey(filePath, key, value) {
  const map = existsSync(filePath) ? parseEnv(readFileSync(filePath, "utf8")) : new Map();
  map.set(key, value);
  if (!dryRun) writeFileSync(filePath, serializeEnv(map));
  console.log(`${dryRun ? "[dry-run] would update" : "Updated"} ${filePath} → ${key}`);
}

async function findExistingPrice(stripe) {
  try {
    const prices = await stripe.prices.list({
      lookup_keys: [LOOKUP_KEY],
      active: true,
      limit: 1,
    });
    const hit = prices.data[0];
    if (hit?.id && hit.unit_amount === UNIT_AMOUNT_CENTS && hit.recurring?.interval === "month") {
      return hit.id;
    }
  } catch {
    // lookup_keys filter may fail on older API keys — fall through to search
  }

  const search = await stripe.prices.search({
    query: `lookup_key:'${LOOKUP_KEY}' AND active:'true'`,
    limit: 1,
  });
  const found = search.data[0];
  if (found?.id) return found.id;
  return null;
}

async function ensureVipPrice(stripe) {
  const existing = await findExistingPrice(stripe);
  if (existing) {
    console.log(`Reusing existing VIP price: ${existing}`);
    return existing;
  }

  if (dryRun) {
    console.log("[dry-run] would create Match Fit Client VIP product + $10/month price");
    return "price_dry_run";
  }

  const product = await stripe.products.create({
    name: PRODUCT_NAME,
    description:
      "Match Fit client VIP membership — full browse, chat, booking, and Fit Hub access.",
    type: "service",
    statement_descriptor: "MATCH FIT VIP",
    metadata: {
      tool_slug: "match-fit",
      purpose: "client_vip",
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: UNIT_AMOUNT_CENTS,
    lookup_key: LOOKUP_KEY,
    nickname: "Match Fit Client VIP — $10/month",
    recurring: { interval: "month", interval_count: 1 },
    metadata: {
      tool_slug: "match-fit",
      purpose: "client_vip",
    },
  });

  console.log(`Created VIP product ${product.id} and price ${price.id}`);
  return price.id;
}

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret?.startsWith("sk_")) {
    console.error("STRIPE_SECRET_KEY is required (sk_live_... or sk_test_...).");
    process.exit(1);
  }

  const stripe = new Stripe(secret, { typescript: true });
  const priceId = await ensureVipPrice(stripe);

  if (priceId === "price_dry_run") {
    console.log("Dry run complete.");
    return;
  }

  const envPath = resolve(root, ".env");
  const secretsPath = resolve(root, ".beta-launch-secrets.local");
  upsertEnvKey(envPath, ENV_KEY, priceId);
  upsertEnvKey(secretsPath, ENV_KEY, priceId);

  console.log(`\n${ENV_KEY}=${priceId}`);
  console.log("Next: npm run vercel:env:client-vip  (or npm run beta:vercel-env after filling other secrets)");

  if (pushVercel) {
    if (dryRun) {
      console.log("[dry-run] would run vercel:env:client-vip");
      return;
    }
    const r = spawnSync("npm", ["run", "vercel:env:client-vip"], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, [ENV_KEY]: priceId },
    });
    process.exit(r.status ?? 1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
