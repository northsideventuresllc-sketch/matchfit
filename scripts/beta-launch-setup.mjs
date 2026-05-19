#!/usr/bin/env node
/**
 * Prepares local .env and optional production secret file for Atlanta beta launch.
 * Does not print secret values to stdout unless --show-secrets.
 *
 * Usage:
 *   node scripts/beta-launch-setup.mjs              # local .env + secrets file
 *   node scripts/beta-launch-setup.mjs --db-push    # also run prisma db push (needs Postgres)
 *   node scripts/beta-launch-setup.mjs --preflight    # check env only
 */
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const examplePath = resolve(root, ".env.example");
const secretsOut = resolve(root, ".beta-launch-secrets.local");

const args = new Set(process.argv.slice(2));
const showSecrets = args.has("--show-secrets");
const dbPush = args.has("--db-push");
const preflightOnly = args.has("--preflight");
const productionPreflight = args.has("--production");

function randomSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function parseEnvFile(text) {
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

function serializeEnv(map) {
  const lines = [];
  for (const [k, v] of map) {
    if (v === "") lines.push(`${k}=`);
    else if (/[\s#"]/.test(v)) lines.push(`${k}="${v.replace(/"/g, '\\"')}"`);
    else lines.push(`${k}=${v}`);
  }
  return `${lines.join("\n")}\n`;
}

const REQUIRED_LOCAL = ["DATABASE_URL", "DIRECT_URL", "AUTH_SECRET"];
const REQUIRED_PRODUCTION_BETA = [
  "MATCH_FIT_BETA_GATES_ENABLED",
  "CRON_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
];
const RECOMMENDED_PRODUCTION = ["CHECKR_WEBHOOK_SECRET"];

function loadEnvFromFile(path) {
  if (!existsSync(path)) return new Map();
  return parseEnvFile(readFileSync(path, "utf8"));
}

function mergeLaunchDefaults(map, { local }) {
  if (!map.get("AUTH_SECRET")) map.set("AUTH_SECRET", randomSecret(32));
  if (!map.get("CRON_SECRET")) map.set("CRON_SECRET", randomSecret(24));

  if (local) {
    if (!map.get("DATABASE_URL")) {
      map.set("DATABASE_URL", "postgresql://matchfit:matchfit@localhost:5432/matchfit");
    }
    if (!map.get("DIRECT_URL")) {
      map.set("DIRECT_URL", "postgresql://matchfit:matchfit@localhost:5432/matchfit");
    }
    map.set("MATCH_FIT_COOKIE_SECURE", "0");
    map.set("NEXT_PUBLIC_APP_URL", map.get("NEXT_PUBLIC_APP_URL") || "http://localhost:3000");
  } else {
    map.set("NEXT_PUBLIC_APP_URL", map.get("NEXT_PUBLIC_APP_URL") || "https://match-fit.net");
  }

  map.set("MATCH_FIT_BETA_GATES_ENABLED", "1");
  if (!map.get("MATCH_FIT_BETA_MAX_TRAINERS")) map.set("MATCH_FIT_BETA_MAX_TRAINERS", "10");
  if (!map.get("MATCH_FIT_BETA_MAX_CLIENTS")) map.set("MATCH_FIT_BETA_MAX_CLIENTS", "50");

  return map;
}

function runPreflight(map, { production }) {
  const keys = production ? [...REQUIRED_LOCAL, ...REQUIRED_PRODUCTION_BETA] : REQUIRED_LOCAL;
  const missing = [];
  for (const k of keys) {
    const v = map.get(k)?.trim();
    if (!v) missing.push(k);
    if (k === "MATCH_FIT_BETA_GATES_ENABLED" && production && v && v !== "1" && v !== "true" && v !== "yes") {
      console.warn(`[preflight] ${k} is "${v}" — use 1 for production beta caps.`);
    }
  }
  if (production) {
    const gates = map.get("MATCH_FIT_BETA_GATES_ENABLED")?.trim();
    if (!gates || (gates !== "1" && gates !== "true" && gates !== "yes")) missing.push("MATCH_FIT_BETA_GATES_ENABLED");
  }
  return [...new Set(missing)];
}

function printVercelInstructions(prodMap) {
  console.log("\n--- Paste into Vercel → Project → Settings → Environment Variables (Production) ---\n");
  const keys = [
    ...REQUIRED_PRODUCTION_BETA,
    ...RECOMMENDED_PRODUCTION,
    "AUTH_SECRET",
    "DATABASE_URL",
    "DIRECT_URL",
  ];
  for (const k of keys) {
    const v = prodMap.get(k);
    if (!v) {
      console.log(`${k}=  ← YOU MUST ADD (not generated here)`);
    } else if (showSecrets) {
      console.log(`${k}=${v}`);
    } else {
      console.log(`${k}=  ← see .beta-launch-secrets.local (generated)`);
    }
  }
  console.log("\nStripe webhook URL: https://YOUR-DOMAIN/api/webhooks/stripe");
  console.log("Checkr webhook URL: https://YOUR-DOMAIN/api/webhooks/checkr");
  console.log("Cron runs automatically every 15 min on Vercel when CRON_SECRET is set.\n");
}

if (preflightOnly) {
  const map = loadEnvFromFile(envPath);
  const missing = runPreflight(map, { production: productionPreflight });
  if (missing.length) {
    console.error("Missing:", missing.join(", "));
    if (productionPreflight) {
      console.error("\nAdd Stripe + Resend keys to .env (from your dashboards), then run again.");
    }
    process.exit(1);
  }
  console.log(productionPreflight ? "Production preflight OK." : "Local preflight OK.");
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error("Missing .env.example");
  process.exit(1);
}

const existing = loadEnvFromFile(envPath);
const localMap = mergeLaunchDefaults(new Map(existing), { local: true });

if (!existsSync(envPath)) {
  copyFileSync(examplePath, envPath);
  const merged = mergeLaunchDefaults(parseEnvFile(readFileSync(envPath, "utf8")), { local: true });
  writeFileSync(envPath, serializeEnv(merged));
  console.log("Created .env with local database URLs and generated AUTH_SECRET + CRON_SECRET.");
} else {
  for (const [k, v] of localMap) {
    if (!existing.get(k)) existing.set(k, v);
  }
  existing.set("MATCH_FIT_BETA_GATES_ENABLED", "1");
  writeFileSync(envPath, serializeEnv(existing));
  console.log("Updated .env (filled missing keys, enabled beta gates).");
}

const prodMap = mergeLaunchDefaults(new Map(), { local: false });
writeFileSync(secretsOut, serializeEnv(prodMap));
console.log(`Wrote production-ready generated secrets to .beta-launch-secrets.local (gitignored).`);

printVercelInstructions(prodMap);

if (dbPush) {
  console.log("Running prisma db push…");
  const r = spawnSync("npx", ["prisma", "db", "push"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...Object.fromEntries(loadEnvFromFile(envPath)) },
  });
  process.exit(r.status ?? 1);
}

console.log("\nNext: add Stripe + Resend keys to .env and Vercel, then run:");
console.log("  npm run beta:preflight");
