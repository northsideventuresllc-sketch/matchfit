#!/usr/bin/env node
/**
 * Bump Match Fit product version in package.json (single source of truth for all UI labels).
 *
 * Usage:
 *   node scripts/bump-product-version.mjs patch --reason "Fix client signup validation"
 *   npm run version:bump -- minor --reason "Admin portal analytics widgets"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bumpMatchFitSemverParts,
  formatMatchFitPackageVersion,
  parseMatchFitPackageVersion,
} from "./product-version-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PACKAGE_JSON_PATH = join(ROOT, "package.json");
const VERSION_HISTORY_PATH = join(ROOT, "VERSION_HISTORY.md");

const LEVELS = new Set(["major", "minor", "patch"]);

function printUsage() {
  console.error(`Usage: npm run version:bump -- <major|minor|patch> [--reason "description"]

Bump levels (owner categorization guide: docs/MATCH_FIT_PRODUCT_VERSION.md):
  major  — transformative product changes (new marketplaces, platform pivots)
  minor  — meaningful features that do not redefine the whole app (admin portal, UI redesign)
  patch  — bug fixes, copy tweaks, small polish

Channel changes (add/remove BETA) require explicit owner approval — do not use this script for that.`);
}

function parseArgs(argv) {
  const positional = [];
  let reason = "";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--reason") {
      reason = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg.startsWith("--reason=")) {
      reason = arg.slice("--reason=".length);
      continue;
    }
    positional.push(arg);
  }

  return { level: positional[0], reason: reason.trim() };
}

function appendVersionHistory({ fromVersion, toVersion, level, reason }) {
  const date = new Date().toISOString().slice(0, 10);
  const reasonLine = reason ? ` — ${reason}` : "";
  const entry = `- **${date}** \`${fromVersion}\` → \`${toVersion}\` (**${level}**${reasonLine})\n`;

  let existing = "";
  try {
    existing = readFileSync(VERSION_HISTORY_PATH, "utf8");
  } catch {
    existing = `# Match Fit version history\n\nAutomated log from \`npm run version:bump\`. UI labels derive from \`package.json\` via \`src/lib/match-fit-product-version.ts\`.\n\n`;
  }

  const marker = "\n## Entries\n\n";
  if (existing.includes(marker)) {
    const [head, tail] = existing.split(marker);
    writeFileSync(VERSION_HISTORY_PATH, `${head}${marker}${entry}${tail ?? ""}`);
  } else {
    writeFileSync(VERSION_HISTORY_PATH, `${existing}${marker}${entry}`);
  }
}

function main() {
  const { level, reason } = parseArgs(process.argv.slice(2));
  if (!level || !LEVELS.has(level)) {
    printUsage();
    process.exit(1);
  }

  const pkgRaw = readFileSync(PACKAGE_JSON_PATH, "utf8");
  const pkg = JSON.parse(pkgRaw);
  const fromVersion = String(pkg.version ?? "");
  const parsed = parseMatchFitPackageVersion(fromVersion);
  const nextParts = bumpMatchFitSemverParts(parsed.parts, level);
  const toVersion = formatMatchFitPackageVersion(nextParts, parsed.channel);

  pkg.version = toVersion;
  writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(pkg, null, 2)}\n`);

  appendVersionHistory({ fromVersion, toVersion, level, reason });

  const label =
    parsed.channel === "beta"
      ? `BETA ${nextParts.major}.${nextParts.minor}.${nextParts.patch}`
      : `${nextParts.major}.${nextParts.minor}.${nextParts.patch}`;

  console.log(`Bumped package.json: ${fromVersion} → ${toVersion}`);
  console.log(`User-facing label after deploy: Version ${label}`);
  if (!reason) {
    console.warn("Tip: pass --reason \"…\" so VERSION_HISTORY.md documents the categorization.");
  }
}

main();
