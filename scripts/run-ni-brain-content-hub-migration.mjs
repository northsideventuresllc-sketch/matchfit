#!/usr/bin/env node
/**
 * Apply Content Hub columns on NI Brain Supabase (project kxijunwgbrlfzvgkhklo).
 *
 * Usage:
 *   NI_BRAIN_DATABASE_URL=postgresql://postgres.[ref]:[password]@... \
 *   node --env-file=.env scripts/run-ni-brain-content-hub-migration.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "ni-brain-content-hub-migration.sql"), "utf8");
const databaseUrl =
  process.env.NI_BRAIN_DATABASE_URL?.trim() ||
  process.env.NI_BRAIN_DIRECT_URL?.trim() ||
  process.env.DIRECT_URL?.trim();

if (!databaseUrl) {
  console.error(
    "Set NI_BRAIN_DATABASE_URL to the NI Brain Postgres connection string (Supabase → Settings → Database).",
  );
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
  const pool = new pg.Pool(poolConfig(databaseUrl));
  try {
    await pool.query(sql);
    console.log("NI Brain Content Hub migration applied successfully.");
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
