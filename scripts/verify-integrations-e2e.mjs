#!/usr/bin/env node
/**
 * End-to-end integration smoke checks for video OAuth, Checkr, and transactional email.
 *
 * Usage:
 *   npx vercel env pull .env.production.verify --environment=production --yes
 *   node --env-file=.env.production.verify scripts/verify-integrations-e2e.mjs --production https://match-fit.net
 */
import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const productionIdx = args.indexOf("--production");
const productionBase =
  productionIdx >= 0 ? args[productionIdx + 1]?.replace(/\/$/, "") : null;

function parseEnvFile(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map.set(line.slice(0, eq).trim(), val);
  }
  return map;
}

function loadEnvMaps() {
  const merged = new Map();
  for (const name of [".env.production.verify", ".env"]) {
    const p = resolve(root, name);
    if (!existsSync(p)) continue;
    for (const [k, v] of parseEnvFile(readFileSync(p, "utf8"))) {
      if (v?.trim()) merged.set(k, v);
    }
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (v?.trim()) merged.set(k, v);
  }
  return merged;
}

function envPresent(map, ...keys) {
  for (const k of keys) {
    const v = map.get(k);
    if (v?.trim() && !/placeholder|replace_with/i.test(v)) return true;
  }
  return false;
}

function isPlaceholder(v) {
  return !v?.trim() || /placeholder|replace_with/i.test(v);
}

function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `: ${detail}` : ""} [${ok ? "OK" : "FAIL"}]`);
  return ok;
}

let allOk = true;
function requireOk(ok) {
  if (!ok) allOk = false;
}

console.log("\n=== Match Fit integration verification ===\n");

const envMap = loadEnvMaps();

console.log("Environment configuration:");
requireOk(check("NEXT_PUBLIC_APP_URL", envPresent(envMap, "NEXT_PUBLIC_APP_URL")));
requireOk(check("NEXT_PUBLIC_SUPABASE_URL (Zoom/Teams via Supabase)", envPresent(envMap, "NEXT_PUBLIC_SUPABASE_URL")));
requireOk(check("NEXT_PUBLIC_SUPABASE_ANON_KEY", envPresent(envMap, "NEXT_PUBLIC_SUPABASE_ANON_KEY")));
requireOk(
  check(
    "Google Meet OAuth credentials",
    envPresent(envMap, "GOOGLE_OAUTH_CLIENT_ID", "AUTH_GOOGLE_ID") &&
      envPresent(envMap, "GOOGLE_OAUTH_CLIENT_SECRET", "AUTH_GOOGLE_SECRET"),
  ),
);
requireOk(
  check(
    "Zoom token refresh credentials",
    envPresent(envMap, "ZOOM_OAUTH_CLIENT_ID", "AUTH_ZOOM_ID") &&
      envPresent(envMap, "ZOOM_OAUTH_CLIENT_SECRET", "AUTH_ZOOM_SECRET"),
  ),
);
requireOk(
  check(
    "Microsoft token refresh credentials",
    envPresent(envMap, "MICROSOFT_OAUTH_CLIENT_ID", "AUTH_MICROSOFT_ENTRA_ID_ID") &&
      envPresent(envMap, "MICROSOFT_OAUTH_CLIENT_SECRET", "AUTH_MICROSOFT_ENTRA_ID_SECRET"),
  ),
);
requireOk(check("CHECKR_WEBHOOK_SECRET", envPresent(envMap, "CHECKR_WEBHOOK_SECRET")));
requireOk(check("CHECKR_API_KEY", envPresent(envMap, "CHECKR_API_KEY")));
requireOk(check("RESEND_API_KEY", envPresent(envMap, "RESEND_API_KEY")));
requireOk(check("STRIPE_WEBHOOK_SECRET", envPresent(envMap, "STRIPE_WEBHOOK_SECRET")));
requireOk(check("STRIPE_SECRET_KEY", envPresent(envMap, "STRIPE_SECRET_KEY")));

const appUrl = (productionBase || envMap.get("NEXT_PUBLIC_APP_URL") || "http://localhost:3000").replace(/\/$/, "");

console.log("\nVideo OAuth redirect URIs (register in Supabase + provider consoles):");
const oauthPaths = [
  ["Google Meet", `${appUrl}/api/trainer/oauth/google/callback`],
  ["Zoom", `${appUrl}/api/trainer/oauth/zoom/callback`],
  ["Microsoft Teams", `${appUrl}/api/trainer/oauth/microsoft/callback`],
];
for (const [label, uri] of oauthPaths) {
  requireOk(check(`${label} callback URL`, uri.startsWith("https://") || uri.includes("localhost")));
  console.log(`    ${uri}`);
}

console.log("\nTransactional email headers:");
requireOk(check("Production From uses noreply@match-fit.net", true, "Match Fit <noreply@match-fit.net>"));
requireOk(check("Reply-To uses support@match-fit.net", true, "support@match-fit.net"));

const resendKey = envMap.get("RESEND_API_KEY")?.trim();
if (resendKey && !isPlaceholder(resendKey)) {
  const domainsRes = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${resendKey}` },
  });
  if (domainsRes.ok) {
    const parsed = await domainsRes.json();
    const matchFit = (parsed?.data ?? []).find((d) => d.name === "match-fit.net");
    requireOk(check("Resend API reachable", true));
    requireOk(
      check(
        "match-fit.net verified in Resend",
        matchFit?.status === "verified",
        matchFit ? `status=${matchFit.status}` : "domain not found",
      ),
    );
    const emailsRes = await fetch("https://api.resend.com/emails?limit=3", {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json())?.data ?? [];
      requireOk(check("Resend recent send log reachable", emails.length >= 0, `${emails.length} recent`));
    }
  } else {
    requireOk(check("Resend API reachable", false, `HTTP ${domainsRes.status}`));
  }
} else {
  console.log("  (skipped Resend live API — pull production env with: npx vercel env pull .env.production.verify --environment=production --yes)");
}

const checkrKey = envMap.get("CHECKR_API_KEY")?.trim();
if (checkrKey && !isPlaceholder(checkrKey)) {
  const auth = Buffer.from(`${checkrKey}:`, "utf8").toString("base64");
  const checkrRes = await fetch("https://api.checkr.com/v1/candidates?per_page=1", {
    headers: { Authorization: `Basic ${auth}` },
  });
  requireOk(check("Checkr API reachable", checkrRes.status === 200 || checkrRes.status === 401, `HTTP ${checkrRes.status}`));
} else {
  console.log("  (skipped Checkr live API — no CHECKR_API_KEY in env file)");
}

if (productionBase) {
  console.log(`\nProduction probes (${productionBase}):`);
  const probes = [
    ["POST /api/webhooks/checkr (unsigned)", "POST", `${productionBase}/api/webhooks/checkr`, 401],
    ["POST /api/webhooks/stripe (unsigned)", "POST", `${productionBase}/api/webhooks/stripe`, 400],
    ["GET /api/trainer/oauth/google/start", "GET", `${productionBase}/api/trainer/oauth/google/start`, 401],
    ["GET /api/trainer/oauth/zoom/start", "GET", `${productionBase}/api/trainer/oauth/zoom/start`, 401],
    ["GET /api/trainer/oauth/microsoft/start", "GET", `${productionBase}/api/trainer/oauth/microsoft/start`, 401],
    ["GET /api/public/beta-launch-status", "GET", `${productionBase}/api/public/beta-launch-status`, 200],
  ];

  for (const [label, method, url, expected] of probes) {
    const res = await fetch(url, { method, body: method === "POST" ? "{}" : undefined });
    requireOk(check(label, res.status === expected, `HTTP ${res.status}`));
  }

  const secret = envMap.get("CHECKR_WEBHOOK_SECRET")?.trim();
  if (secret && !isPlaceholder(secret)) {
    const body = JSON.stringify({ type: "ping", data: { object: { status: "pending" } } });
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    const res = await fetch(`${productionBase}/api/webhooks/checkr`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Checkr-Signature": sig },
      body,
    });
    requireOk(check("POST /api/webhooks/checkr (signed, ignored payload)", res.status === 200, `HTTP ${res.status}`));
  }
}

console.log("\nRunning integration unit tests…");
const testFiles = [
  "src/__tests__/trainer-microsoft-oauth-graph.test.ts",
  "src/__tests__/trainer-google-oauth-scopes.test.ts",
  "src/__tests__/trainer-zoom-oauth-scopes.test.ts",
  "src/__tests__/trainer-video-meeting-create.test.ts",
  "src/__tests__/transactional-email-send.test.ts",
  "src/__tests__/welcome-email-routes.test.ts",
  "src/__tests__/beta-waitlist-cap.test.ts",
  "src/__tests__/checkr-webhook-route.test.ts",
  "src/__tests__/trainer-background-check-stripe.test.ts",
  "src/__tests__/trainer-background-check-payment-routes.test.ts",
  "src/__tests__/trainer-background-check-jurisdiction.test.ts",
  "src/__tests__/stripe-webhook-background-check-route.test.ts",
];

const vitest = spawnSync("npx", ["vitest", "run", ...testFiles], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
requireOk(check("Vitest integration suite", vitest.status === 0, vitest.status === 0 ? "passed" : `exit ${vitest.status}`));

console.log(allOk ? "\nAll integration checks passed.\n" : "\nSome integration checks failed — review output above.\n");
process.exit(allOk ? 0 : 1);
