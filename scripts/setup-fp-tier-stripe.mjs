#!/usr/bin/env node
/**
 * Idempotently ensure Match Fit FP tier Stripe products + prices exist (test mode recommended).
 *
 * Creates:
 * - Independent Fitness Pro $15/mo
 * - Elite Fitness Pro $40/mo
 * - À la carte promote token $2 one-time
 *
 * Usage:
 *   node --env-file=.env scripts/setup-fp-tier-stripe.mjs
 *   node --env-file=.env scripts/setup-fp-tier-stripe.mjs --dry-run
 */
import Stripe from "stripe";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

const PRODUCTS = [
  {
    lookupKey: "match_fit_independent_fp_monthly",
    envKey: "MATCH_FIT_INDEPENDENT_FP_STRIPE_PRICE_ID",
    name: "Match Fit Independent Fitness Pro",
    unitAmountCents: 1500,
    recurring: { interval: "month" },
  },
  {
    lookupKey: "match_fit_elite_fp_monthly",
    envKey: "MATCH_FIT_ELITE_FP_STRIPE_PRICE_ID",
    name: "Match Fit Elite Fitness Pro",
    unitAmountCents: 4000,
    recurring: { interval: "month" },
  },
  {
    lookupKey: "match_fit_fp_promote_token",
    envKey: "MATCH_FIT_FP_PROMOTE_TOKEN_STRIPE_PRICE_ID",
    name: "Match Fit Promote Token",
    unitAmountCents: 200,
    recurring: null,
  },
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
  console.log(`${dryRun ? "[dry-run] would update" : "Updated"} ${filePath} → ${key}=${value}`);
}

async function ensurePrice(stripe, spec) {
  const existing = await stripe.prices.list({ lookup_keys: [spec.lookupKey], active: true, limit: 1 });
  const hit = existing.data[0];
  if (hit?.id && hit.unit_amount === spec.unitAmountCents) {
    console.log(`Reusing ${spec.lookupKey}: ${hit.id}`);
    return hit.id;
  }

  const product = await stripe.products.create({
    name: spec.name,
    metadata: { match_fit_fp_tier: spec.lookupKey },
  });

  const priceData = {
    product: product.id,
    currency: "usd",
    unit_amount: spec.unitAmountCents,
    lookup_key: spec.lookupKey,
    transfer_lookup_key: true,
    ...(spec.recurring ? { recurring: spec.recurring } : {}),
  };

  if (dryRun) {
    console.log(`[dry-run] would create price for ${spec.lookupKey}`);
    return `price_dry_run_${spec.lookupKey}`;
  }

  const price = await stripe.prices.create(priceData);
  console.log(`Created ${spec.lookupKey}: ${price.id}`);
  return price.id;
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY is required.");
    process.exit(1);
  }
  if (!key.startsWith("sk_test_")) {
    console.warn("Warning: use test mode keys until FP tier billing is approved for live.");
  }

  const stripe = new Stripe(key);
  const envFiles = [resolve(root, ".env"), resolve(root, ".beta-launch-secrets.local")];

  for (const spec of PRODUCTS) {
    const priceId = await ensurePrice(stripe, spec);
    for (const file of envFiles) {
      if (existsSync(file) || !dryRun) {
        upsertEnvKey(file, spec.envKey, priceId);
      }
    }
  }

  console.log("FP tier Stripe setup complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
