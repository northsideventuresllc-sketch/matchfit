#!/usr/bin/env node
/**
 * Pushes beta launch env vars from .beta-launch-secrets.local + .env to Vercel (production).
 * Requires: vercel CLI logged in (`npx vercel link`) and secrets file from beta-launch-setup.mjs
 *
 * Usage:
 *   node scripts/vercel-env-push-beta.mjs --dry-run
 *   node scripts/vercel-env-push-beta.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

const KEYS = [
  "MATCH_FIT_BETA_GATES_ENABLED",
  "MATCH_FIT_BETA_MAX_TRAINERS",
  "MATCH_FIT_BETA_MAX_CLIENTS",
  "CRON_SECRET",
  "AUTH_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
  "CHECKR_WEBHOOK_SECRET",
  "DATABASE_URL",
  "DIRECT_URL",
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

function loadMerged() {
  const merged = new Map();
  for (const file of [".env", ".beta-launch-secrets.local"]) {
    const p = resolve(root, file);
    if (!existsSync(p)) continue;
    for (const [k, v] of parseEnv(readFileSync(p, "utf8"))) {
      if (v) merged.set(k, v);
    }
  }
  return merged;
}

const map = loadMerged();
const missing = KEYS.filter((k) => !map.get(k)?.trim());
if (missing.length) {
  console.error("Missing values for:", missing.join(", "));
  console.error("Add them to .env or .beta-launch-secrets.local, then retry.");
  process.exit(1);
}

for (const key of KEYS) {
  const value = map.get(key);
  if (dryRun) {
    console.log(`[dry-run] vercel env add ${key} production`);
    continue;
  }
  const r = spawnSync(
    "npx",
    ["vercel", "env", "add", key, "production", "--force"],
    {
      cwd: root,
      input: value,
      stdio: ["pipe", "inherit", "inherit"],
      encoding: "utf8",
    },
  );
  if (r.status !== 0) {
    console.error(`Failed to set ${key}. Run: npx vercel link`);
    process.exit(1);
  }
  console.log(`Set ${key} (production)`);
}

console.log(dryRun ? "Dry run complete." : "Done. Redeploy production for changes to apply.");
