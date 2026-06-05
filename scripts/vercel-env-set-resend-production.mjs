#!/usr/bin/env node
/**
 * Push Resend keys to Vercel production (matchfit project) via REST API.
 * Requires VERCEL_TOKEN (personal/team token from vercel.com/account/tokens).
 *
 * Usage:
 *   VERCEL_TOKEN=... node scripts/vercel-env-set-resend-production.mjs
 *   VERCEL_TOKEN=... RESEND_API_KEY=... RESEND_FROM_EMAIL=... node scripts/vercel-env-set-resend-production.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const teamId = "team_dD8iOW15WOUr27k3QeswFBac";
const projectId = "matchfit";

const ENV_KEYS = ["RESEND_API_KEY", "RESEND_FROM_EMAIL"];

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
  for (const key of ENV_KEYS) {
    const fromEnv = process.env[key]?.trim();
    if (fromEnv) map.set(key, fromEnv);
  }

  if (process.argv.includes("--from-secrets-file")) {
    const secretsPath = resolve(root, ".beta-launch-secrets.local");
    if (existsSync(secretsPath)) {
      for (const [k, v] of parseEnv(readFileSync(secretsPath, "utf8"))) {
        if (ENV_KEYS.includes(k) && v?.trim()) map.set(k, v.trim());
      }
    }
  }

  const apiKey = map.get("RESEND_API_KEY") ?? "";
  if (!apiKey.startsWith("re_")) {
    console.error("RESEND_API_KEY must be set (re_...).");
    process.exit(1);
  }

  const fromEmail = map.get("RESEND_FROM_EMAIL") ?? "";
  if (!fromEmail.includes("@")) {
    console.error("RESEND_FROM_EMAIL must be set (display name + noreply address on match-fit.net).");
    process.exit(1);
  }

  return map;
}

async function upsertEnv(key, value, token) {
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
      target: ["production"],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to set ${key}: HTTP ${res.status} ${body.slice(0, 240)}`);
  }
  console.log(`Set ${key} (production)`);
}

async function verifyResendKey(apiKey) {
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RESEND_API_KEY probe failed: HTTP ${res.status} ${body.slice(0, 160)}`);
  }
  const json = await res.json();
  const domains = (json.data ?? []).map((d) => d.name);
  if (!domains.includes("match-fit.net")) {
    throw new Error(`RESEND_API_KEY is valid but match-fit.net is not verified (domains: ${domains.join(", ") || "none"}).`);
  }
  console.log("Verified RESEND_API_KEY against match-fit.net");
}

async function main() {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    console.error("VERCEL_TOKEN is required. Create one at https://vercel.com/account/tokens");
    process.exit(1);
  }

  const values = loadValues();
  await verifyResendKey(values.get("RESEND_API_KEY"));

  for (const key of ENV_KEYS) {
    await upsertEnv(key, values.get(key), token);
  }

  console.log("Done. No redeploy required — production picks up encrypted env vars on next invocation.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
