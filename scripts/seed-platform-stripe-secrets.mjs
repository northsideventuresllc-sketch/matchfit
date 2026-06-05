#!/usr/bin/env node
/**
 * Seeds live Stripe keys into platform_secrets (production DB bootstrap).
 * Used when Vercel env still has placeholder sk_test values.
 *
 * Usage:
 *   node --env-file=.beta-launch-secrets.local scripts/seed-platform-stripe-secrets.mjs
 */
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

function pgPoolConfig(connectionString) {
  const config = { connectionString };
  try {
    const host = new URL(connectionString).hostname;
    if (host.includes("supabase.com") || host.includes("supabase.co")) {
      config.ssl = { rejectUnauthorized: false };
    }
  } catch {
    // ignore
  }
  return config;
}

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
  for (const key of KEYS) {
    const fromEnv = process.env[key]?.trim();
    if (fromEnv) map.set(key, fromEnv);
  }

  const secretsPath = resolve(root, ".beta-launch-secrets.local");
  if (existsSync(secretsPath)) {
    for (const [k, v] of parseEnv(readFileSync(secretsPath, "utf8"))) {
      if (KEYS.includes(k) && v?.trim()) map.set(k, v.trim());
    }
  }

  for (const key of KEYS) {
    if (!map.get(key)?.trim()) {
      console.error(`Missing ${key} in env or .beta-launch-secrets.local`);
      process.exit(1);
    }
  }
  return map;
}

const ddl = `
CREATE TABLE IF NOT EXISTS public.platform_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

const values = loadValues();
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new pg.Pool({
  ...pgPoolConfig(databaseUrl),
  max: 1,
});

try {
  await pool.query(ddl);
  for (const key of KEYS) {
    await pool.query(
      `INSERT INTO public.platform_secrets (key, value, "updatedAt")
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()`,
      [key, values.get(key)],
    );
    console.log(`Upserted platform_secrets.${key}`);
  }
  console.log("Stripe platform secrets seeded.");
} finally {
  await pool.end().catch(() => {});
}
