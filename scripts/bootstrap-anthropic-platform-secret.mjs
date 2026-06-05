#!/usr/bin/env node
/**
 * Store Anthropic admin-assistant keys in platform_secrets (production DB).
 * Uses DATABASE_URL / DIRECT_URL from the environment (same as other bootstrap scripts).
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node --env-file=.env scripts/bootstrap-anthropic-platform-secret.mjs
 */
import pg from "pg";

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
const model = process.env.ANTHROPIC_ADMIN_ANALYTICS_MODEL?.trim() || "claude-sonnet-4-6";
const connectionString =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DATABASE_POOLER_URL?.trim();

if (!apiKey?.startsWith("sk-ant-")) {
  console.error("ANTHROPIC_API_KEY must be set (sk-ant-...).");
  process.exit(1);
}

if (!connectionString) {
  console.error("DATABASE_URL or DIRECT_URL is required.");
  process.exit(1);
}

function poolConfig(raw) {
  let normalized = raw.trim();
  try {
    const url = new URL(normalized);
    url.searchParams.delete("sslmode");
    normalized = url.toString();
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
  await upsert("ANTHROPIC_API_KEY", apiKey);
  await upsert("ANTHROPIC_ADMIN_ANALYTICS_MODEL", model);
  console.log("Done. Production hydrates these on next serverless cold start.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
