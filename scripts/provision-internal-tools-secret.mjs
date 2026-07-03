#!/usr/bin/env node
/**
 * Generate and store MATCHFIT_INTERNAL_TOOLS_SECRET for production ops routes.
 *
 * 1. Upserts into platform_secrets (hydrated at runtime when Vercel env is unset)
 * 2. Pushes to Vercel production when VERCEL_TOKEN is set
 *
 * Usage:
 *   node scripts/provision-internal-tools-secret.mjs
 *   VERCEL_TOKEN=... node scripts/provision-internal-tools-secret.mjs
 */
import crypto from "node:crypto";
import pg from "pg";

const teamId = "team_dD8iOW15WOUr27k3QeswFBac";
const projectId = "matchfit";
const key = "MATCHFIT_INTERNAL_TOOLS_SECRET";

function generateSecret() {
  return crypto.randomBytes(24).toString("base64url").slice(0, 32);
}

function databaseUrl() {
  const raw = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error("DATABASE_URL or DIRECT_URL is required.");
  }
  return raw;
}

async function upsertPlatformSecret(value) {
  const pool = new pg.Pool({ connectionString: databaseUrl(), max: 1 });
  try {
    await pool.query(
      `INSERT INTO public.platform_secrets (key, value, "updatedAt")
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()`,
      [key, value],
    );
    console.log("Stored MATCHFIT_INTERNAL_TOOLS_SECRET in platform_secrets.");
  } finally {
    await pool.end().catch(() => {});
  }
}

async function upsertVercelEnv(value) {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    console.log("VERCEL_TOKEN not set — skipped Vercel env push (runtime hydration will apply).");
    return;
  }

  const url = new URL(`https://api.vercel.com/v10/projects/${projectId}/env`);
  url.searchParams.set("upsert", "true");
  url.searchParams.set("teamId", teamId);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      value,
      type: "encrypted",
      target: ["production", "preview", "development"],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel env upsert failed: HTTP ${res.status} ${body.slice(0, 240)}`);
  }

  console.log("Set MATCHFIT_INTERNAL_TOOLS_SECRET on Vercel (production, preview, development).");
}

async function main() {
  const value = generateSecret();
  if (value.length < 16) {
    throw new Error("Generated secret was too short.");
  }

  await upsertPlatformSecret(value);
  await upsertVercelEnv(value);
  console.log("Done. Secret value was not printed. Redeploy production if Vercel env was updated.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
