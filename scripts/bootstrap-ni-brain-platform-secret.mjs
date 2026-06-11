#!/usr/bin/env node
/**
 * Store NI Brain Supabase keys in platform_secrets (production DB).
 * Uses DATABASE_URL / DIRECT_URL from the environment (same as other bootstrap scripts).
 *
 * Usage:
 *   NI_BRAIN_SUPABASE_URL=https://kxijunwgbrlfzvgkhklo.supabase.co \
 *   NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node --env-file=.env scripts/bootstrap-ni-brain-platform-secret.mjs
 */
import pg from "pg";

const url = process.env.NI_BRAIN_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY?.trim();
const databaseUrl = process.env.NI_BRAIN_DATABASE_URL?.trim();
const databasePassword = process.env.NI_BRAIN_DATABASE_PASSWORD?.trim();
const connectionString =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DATABASE_POOLER_URL?.trim();

if (!url?.includes("supabase.co")) {
  console.error("NI_BRAIN_SUPABASE_URL must be set (https://*.supabase.co).");
  process.exit(1);
}

if (!serviceRoleKey || serviceRoleKey.length < 20) {
  console.error("NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY must be set (service role JWT).");
  process.exit(1);
}

if (!connectionString) {
  console.error("DATABASE_URL or DIRECT_URL is required.");
  process.exit(1);
}

function poolConfig(raw) {
  let normalized = raw.trim();
  try {
    const parsed = new URL(normalized);
    parsed.searchParams.delete("sslmode");
    normalized = parsed.toString();
  } catch {
    // keep raw
  }
  const host = (() => {
    try {
      return new URL(normalized).hostname;
    } catch {
      return "";
    }
  })();
  const config = { connectionString: normalized, max: 1 };
  if (host.includes("supabase.com") || host.includes("supabase.co")) {
    config.ssl = { rejectUnauthorized: false };
  }
  return config;
}

async function upsert(key, value) {
  const pool = new pg.Pool(poolConfig(connectionString));
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS public.platform_secrets (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
    await pool.query(
      `INSERT INTO public.platform_secrets (key, value, "updatedAt")
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()`,
      [key, value],
    );
    console.log(`Stored ${key} in platform_secrets`);
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  await upsert("NI_BRAIN_SUPABASE_URL", url);
  await upsert("NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey);
  if (databaseUrl) {
    await upsert("NI_BRAIN_DATABASE_URL", databaseUrl);
  } else if (databasePassword) {
    await upsert("NI_BRAIN_DATABASE_PASSWORD", databasePassword);
    console.log(
      "Stored NI_BRAIN_DATABASE_PASSWORD — production will derive the Postgres URL for Content Hub schema repair.",
    );
  } else {
    console.warn(
      "Tip: set NI_BRAIN_DATABASE_PASSWORD or NI_BRAIN_DATABASE_URL so Content Hub can auto-apply NI Brain migrations.",
    );
  }
  console.log("Done. Production hydrates these on next serverless cold start.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
