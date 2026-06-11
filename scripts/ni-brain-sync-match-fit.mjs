#!/usr/bin/env node
/**
 * Sync Match Fit build knowledge to NI Brain (schema summary, version, key libs, migrations).
 *
 * Usage:
 *   node --env-file=.env scripts/ni-brain-sync-match-fit.mjs
 *   node --env-file=.env scripts/ni-brain-sync-match-fit.mjs --verify-only
 *   npm run ni-brain:sync
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createNiBrainScriptClient,
  isNiBrainConfigured,
  recordNiBrainBuildLog,
  recordNiBrainLearning,
  sanitizeForNiBrain,
  upsertMatchFitBuildContext,
} from "./ni-brain-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const KEY_LIB_GLOBS = [
  "src/lib/prisma.ts",
  "src/lib/session.ts",
  "src/lib/ni-brain-client.ts",
  "src/lib/outreach-learning.ts",
  "src/lib/content-calendar/content-calendar-ai.ts",
  "src/lib/client-platform-access.ts",
  "src/lib/trainer-service-offerings.ts",
  "src/lib/match-fit-product-version.ts",
];

function readText(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

function listPrismaModels(schema) {
  return [...schema.matchAll(/^model\s+(\w+)\s+\{/gm)].map((m) => m[1]);
}

function listRecentMigrations(limit = 8) {
  const dir = join(ROOT, "prisma/migrations");
  try {
    return readdirSync(dir)
      .filter((name) => statSync(join(dir, name)).isDirectory())
      .sort()
      .slice(-limit);
  } catch {
    return [];
  }
}

function listPortalSurfaces() {
  return [
    "Public marketing (src/app/page.tsx, /promos)",
    "Client portal (src/app/client/*)",
    "Trainer portal (src/app/trainer/*)",
    "Admin portal (src/app/admin/*)",
    "API routes (src/app/api/*)",
  ];
}

function buildArchitectureSummary() {
  const pkg = JSON.parse(readText("package.json"));
  const schema = readText("prisma/schema.prisma");
  const models = listPrismaModels(schema);
  const migrations = listRecentMigrations();
  const portals = listPortalSurfaces();

  const libNotes = KEY_LIB_GLOBS.filter((p) => {
    try {
      readText(p);
      return true;
    } catch {
      return false;
    }
  });

  const agents = readText("AGENTS.md")
    .split("\n")
    .filter((line) => line.startsWith("|") || line.startsWith("-") || line.startsWith("##"))
    .slice(0, 40)
    .join("\n");

  return {
    productVersion: pkg.version,
    modelCount: models.length,
    models,
    migrations,
    libModules: libNotes,
    portals,
    agentsExcerpt: agents,
  };
}

function formatBuildContext(summary) {
  const now = new Date().toISOString().slice(0, 10);
  return sanitizeForNiBrain(`MATCH FIT — BUILD CONTEXT | Auto-sync: ${now}

PRODUCT
- Version: ${summary.productVersion}
- Stack: Next.js 16 App Router + Prisma 7 (Postgres) + Turbopack
- Portals: client, trainer, admin (+ public marketing)
- NI classification: Sector 1A non-autonomous marketplace

SCHEMA (${summary.modelCount} Prisma models)
${summary.models.map((m) => `- ${m}`).join("\n")}

RECENT MIGRATIONS
${summary.migrations.length ? summary.migrations.map((m) => `- ${m}`).join("\n") : "- (none listed)"}

KEY LIB MODULES
${summary.libModules.map((m) => `- ${m}`).join("\n")}

APP SURFACE (partial)
${summary.portals.slice(0, 24).map((p) => `- ${p}`).join("\n")}

OPS / CONVENTIONS (from AGENTS.md)
${summary.agentsExcerpt}

NI BRAIN INTEGRATION
- Runtime client: src/lib/ni-brain-client.ts
- Sync script: scripts/ni-brain-sync-match-fit.mjs
- Tool slug: match-fit (arm3_tools / arm3_weekly_logs)
- Learning tables: Learnings, Decisions, Context, match_fit_content_*
`);
}

async function main() {
  const verifyOnly = process.argv.includes("--verify-only");

  if (!isNiBrainConfigured()) {
    console.error(
      "NI Brain env vars missing. Set NI_BRAIN_SUPABASE_URL and NI_BRAIN_SUPABASE_SERVICE_ROLE_KEY in .env",
    );
    process.exit(1);
  }

  const client = createNiBrainScriptClient();
  const summary = buildArchitectureSummary();
  const contextBody = formatBuildContext(summary);

  if (verifyOnly) {
    console.log("NI Brain connection OK (project ref validated).");
    console.log(`Would sync ${summary.modelCount} models at version ${summary.productVersion}.`);
    return;
  }

  const ctx = await upsertMatchFitBuildContext(client, contextBody);
  await recordNiBrainBuildLog(client, {
    logType: "build_sync",
    summary: `Match Fit build sync — v${summary.productVersion}, ${summary.modelCount} models`,
    detail: {
      product_version: summary.productVersion,
      model_count: summary.modelCount,
      models: summary.models,
      recent_migrations: summary.migrations,
      key_libs: summary.libModules,
      synced_at: new Date().toISOString(),
    },
  });
  await recordNiBrainLearning(client, {
    learning: `Match Fit build snapshot synced at v${summary.productVersion} with ${summary.modelCount} Prisma models and ${summary.migrations.length} recent migrations tracked.`,
    source: "match fit ni-brain sync",
  });

  console.log(`NI Brain sync complete (${ctx.action} Context id=${ctx.id}).`);
  console.log(`Version ${summary.productVersion} · ${summary.modelCount} models · tool slug match-fit`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
