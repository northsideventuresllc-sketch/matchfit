#!/usr/bin/env node
/**
 * Seeds Gemini fallback keys into platform_secrets (production DB).
 * Used when Vercel env vars are not yet set — hydratePlatformEnvFromDatabase reads these.
 *
 * Usage:
 *   GEMINI_API_KEY=AQ.... node scripts/seed-platform-gemini-secrets.mjs
 */
import pg from "pg";

const KEYS = ["GEMINI_API_KEY", "GEMINI_MODEL"];

function isValidGeminiApiKey(key) {
  const trimmed = key?.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("AIza") || trimmed.startsWith("AQ.");
}

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

function loadValues() {
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  if (!isValidGeminiApiKey(apiKey)) {
    console.error("GEMINI_API_KEY must be set (AQ.... or AIza....).");
    process.exit(1);
  }
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  return new Map([
    ["GEMINI_API_KEY", apiKey],
    ["GEMINI_MODEL", model],
  ]);
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
  console.log("Gemini platform secrets seeded.");
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
} finally {
  await pool.end().catch(() => {});
}
