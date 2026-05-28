#!/usr/bin/env node
/**
 * Applies pending Prisma migrations to the database pointed at by DATABASE_URL / DIRECT_URL.
 *
 * Usage:
 *   npm run db:migrate
 *   node --env-file=.env scripts/apply-pending-migrations.mjs
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!url) {
  console.error("Set DIRECT_URL or DATABASE_URL before running migrations.");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
