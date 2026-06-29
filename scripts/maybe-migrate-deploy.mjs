#!/usr/bin/env node
/**
 * Applies pending Prisma migrations during Vercel production builds only.
 * CI and local `npm run build` skip this (CI DB is not baselined for migrate deploy).
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function shouldRunMigrateDeploy() {
  if (process.env.VERCEL !== "1" && !process.env.VERCEL_ENV) return false;
  return Boolean(process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim());
}

if (!shouldRunMigrateDeploy()) {
  process.exit(0);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

if ((result.status ?? 1) === 0) {
  process.exit(0);
}

const isProductionBuild =
  process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

if (isProductionBuild) {
  console.error("[maybe-migrate-deploy] prisma migrate deploy failed on production build.");
  process.exit(result.status ?? 1);
}

console.warn(
  "[maybe-migrate-deploy] prisma migrate deploy failed; continuing non-production build.",
);
process.exit(0);
