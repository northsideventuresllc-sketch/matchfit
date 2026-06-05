#!/usr/bin/env node
/**
 * Set Stripe publishable key on Vercel production (no local secrets file required).
 * Requires: vercel CLI logged in and project linked (`npx vercel link`).
 *
 * Usage:
 *   STRIPE_PUBLISHABLE_KEY=pk_live_... node scripts/vercel-env-set-stripe-publishable.mjs
 *   node scripts/vercel-env-set-stripe-publishable.mjs pk_live_...
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const key = (process.env.STRIPE_PUBLISHABLE_KEY ?? process.argv[2] ?? "").trim();

if (!key.startsWith("pk_live_") && !key.startsWith("pk_test_")) {
  console.error("Provide a Stripe publishable key (pk_live_... or pk_test_...).");
  process.exit(1);
}

for (const envName of ["STRIPE_PUBLISHABLE_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]) {
  const r = spawnSync("npx", ["vercel", "env", "add", envName, "production", "--force"], {
    cwd: root,
    input: key,
    stdio: ["pipe", "inherit", "inherit"],
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(`Failed to set ${envName}. Run: npx vercel link`);
    process.exit(1);
  }
  console.log(`Set ${envName} (production)`);
}

console.log("Done. Production functions pick up STRIPE_PUBLISHABLE_KEY immediately; redeploy for NEXT_PUBLIC in client bundles.");
