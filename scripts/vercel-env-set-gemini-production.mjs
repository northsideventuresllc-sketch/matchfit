#!/usr/bin/env node
/**
 * Push Gemini fallback keys to Vercel via REST API.
 * Requires VERCEL_TOKEN (personal/team token from vercel.com/account/tokens).
 *
 * Usage:
 *   VERCEL_TOKEN=... GEMINI_API_KEY=AQ.... node scripts/vercel-env-set-gemini-production.mjs
 *   VERCEL_TOKEN=... GEMINI_API_KEY=AQ.... node scripts/vercel-env-set-gemini-production.mjs --project match-fit-app
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const teamId = "team_dD8iOW15WOUr27k3QeswFBac";
const DEFAULT_PROJECT_IDS = ["matchfit", "match-fit-app"];

const ENV_KEYS = ["GEMINI_API_KEY", "GEMINI_MODEL"];

function isValidGeminiApiKey(key) {
  const trimmed = key?.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("AIza") || trimmed.startsWith("AQ.");
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

function resolveProjectIds() {
  const projectFlag = process.argv.indexOf("--project");
  if (projectFlag !== -1 && process.argv[projectFlag + 1]) {
    return [process.argv[projectFlag + 1].trim()];
  }
  return DEFAULT_PROJECT_IDS;
}

function loadValues() {
  const map = new Map();
  for (const key of ENV_KEYS) {
    const fromEnv = process.env[key]?.trim();
    if (fromEnv) map.set(key, fromEnv);
  }

  const envPath = resolve(root, ".env");
  if (existsSync(envPath)) {
    for (const [k, v] of parseEnv(readFileSync(envPath, "utf8"))) {
      if (ENV_KEYS.includes(k) && v?.trim() && !map.has(k)) map.set(k, v.trim());
    }
  }

  const apiKey = map.get("GEMINI_API_KEY") ?? "";
  if (!isValidGeminiApiKey(apiKey)) {
    console.error("GEMINI_API_KEY must be set (AQ.... or AIza....).");
    process.exit(1);
  }

  if (!map.has("GEMINI_MODEL")) {
    map.set("GEMINI_MODEL", "gemini-2.0-flash");
  }

  return map;
}

async function upsertEnv(projectId, key, value, token, targets) {
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
      target: targets,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to set ${key} on ${projectId}: HTTP ${res.status} ${body.slice(0, 240)}`);
  }
  console.log(`Set ${key} on ${projectId} (${targets.join(", ")})`);
}

async function verifyGeminiKey(apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Reply with OK only." }] }],
      generationConfig: { maxOutputTokens: 8 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GEMINI_API_KEY probe failed: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  console.log(`Verified GEMINI_API_KEY against ${model}`);
}

async function main() {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    console.error("VERCEL_TOKEN is required. Create one at https://vercel.com/account/tokens");
    process.exit(1);
  }

  const projectIds = resolveProjectIds();
  const values = loadValues();
  const model = values.get("GEMINI_MODEL") ?? "gemini-2.0-flash";

  await verifyGeminiKey(values.get("GEMINI_API_KEY"), model);

  for (const projectId of projectIds) {
    for (const targets of [["production"], ["preview"]]) {
      for (const key of ENV_KEYS) {
        const value = values.get(key);
        if (!value) continue;
        await upsertEnv(projectId, key, value, token, targets);
      }
    }
  }

  console.log(`Done (${projectIds.join(", ")}). Serverless functions pick up encrypted env vars on next invocation.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
