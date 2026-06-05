#!/usr/bin/env node
/**
 * Push Anthropic admin-assistant keys to Vercel production via REST API.
 * Requires VERCEL_TOKEN (personal/team token from vercel.com/account/tokens).
 *
 * Usage:
 *   VERCEL_TOKEN=... ANTHROPIC_API_KEY=sk-ant-... node scripts/vercel-env-set-anthropic-production.mjs
 *   VERCEL_TOKEN=... ANTHROPIC_API_KEY=sk-ant-... node scripts/vercel-env-set-anthropic-production.mjs --project match-fit-app
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const teamId = "team_dD8iOW15WOUr27k3QeswFBac";
const DEFAULT_PROJECT_ID = "matchfit";

const ENV_KEYS = ["ANTHROPIC_API_KEY", "ANTHROPIC_ADMIN_ANALYTICS_MODEL"];

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

function resolveProjectId() {
  const projectFlag = process.argv.indexOf("--project");
  if (projectFlag !== -1 && process.argv[projectFlag + 1]) {
    return process.argv[projectFlag + 1].trim();
  }
  return DEFAULT_PROJECT_ID;
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

  const apiKey = map.get("ANTHROPIC_API_KEY") ?? "";
  if (!apiKey.startsWith("sk-ant-")) {
    console.error("ANTHROPIC_API_KEY must be set (sk-ant-...).");
    process.exit(1);
  }

  return map;
}

async function upsertEnv(projectId, key, value, token) {
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
    throw new Error(`Failed to set ${key} on ${projectId}: HTTP ${res.status} ${body.slice(0, 240)}`);
  }
  console.log(`Set ${key} (production) on ${projectId}`);
}

async function verifyAnthropicKey(apiKey, model) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ANTHROPIC_API_KEY probe failed: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  console.log(`Verified ANTHROPIC_API_KEY against ${model}`);
}

async function main() {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    console.error("VERCEL_TOKEN is required. Create one at https://vercel.com/account/tokens");
    process.exit(1);
  }

  const projectId = resolveProjectId();
  const values = loadValues();
  const model = values.get("ANTHROPIC_ADMIN_ANALYTICS_MODEL") ?? "claude-sonnet-4-6";

  await verifyAnthropicKey(values.get("ANTHROPIC_API_KEY"), model);

  for (const key of ENV_KEYS) {
    const value = values.get(key);
    if (!value) continue;
    await upsertEnv(projectId, key, value, token);
  }

  console.log(`Done (${projectId}). Production picks up encrypted env vars on next invocation.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
