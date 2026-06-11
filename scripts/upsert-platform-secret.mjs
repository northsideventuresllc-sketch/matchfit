#!/usr/bin/env node
/**
 * Upsert a single key in platform_secrets (Match Fit production DB).
 * Usage: KEY=NI_BRAIN_DATABASE_PASSWORD VALUE=... DATABASE_URL=... node scripts/upsert-platform-secret.mjs
 */
import pg from "pg";

const key = process.env.KEY?.trim();
const value = process.env.VALUE?.trim();
const connectionString = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!key || !value) {
  console.error("KEY and VALUE are required.");
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

async function main() {
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

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
