#!/usr/bin/env node
/**
 * Seeds the Northside AI Vault keys into platform_secrets.
 *
 * Order of use at runtime:
 * 1. ANTHROPIC_API_KEY (Claude — auto model by task complexity)
 * 2. GEMINI_API_KEY (primary)
 * 3. GEMINI_API_KEY_BACKUP (secondary)
 *
 * Usage:
 *   node scripts/seed-ai-vault-secrets.mjs
 *   ANTHROPIC_API_KEY=sk-ant-... GEMINI_API_KEY=AIza... GEMINI_API_KEY_BACKUP=AQ.... node scripts/seed-ai-vault-secrets.mjs
 */
import pg from "pg";

const KEYS = [
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GEMINI_API_KEY_BACKUP",
  "GEMINI_MODEL",
];

function isValidAnthropic(key) {
  return Boolean(key?.trim().startsWith("sk-ant-"));
}

function isValidGemini(key) {
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
  const map = new Map();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  const geminiPrimary = process.env.GEMINI_API_KEY?.trim();
  const geminiBackup = process.env.GEMINI_API_KEY_BACKUP?.trim();
  const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

  if (!isValidAnthropic(anthropic)) {
    console.error("ANTHROPIC_API_KEY must be set (sk-ant-...).");
    process.exit(1);
  }
  if (!isValidGemini(geminiPrimary)) {
    console.error("GEMINI_API_KEY must be set (AIza... or AQ....).");
    process.exit(1);
  }
  if (!isValidGemini(geminiBackup)) {
    console.error("GEMINI_API_KEY_BACKUP must be set (AIza... or AQ....).");
    process.exit(1);
  }

  map.set("ANTHROPIC_API_KEY", anthropic);
  map.set("GEMINI_API_KEY", geminiPrimary);
  map.set("GEMINI_API_KEY_BACKUP", geminiBackup);
  map.set("GEMINI_MODEL", geminiModel);
  return map;
}

const ddl = `
CREATE TABLE IF NOT EXISTS public.platform_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const values = loadValues();
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
  console.log("AI Vault secrets seeded.");
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
} finally {
  await pool.end().catch(() => {});
}
