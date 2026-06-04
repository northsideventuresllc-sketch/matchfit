#!/usr/bin/env node
/**
 * CI guard: product-facing changes must include a package.json version bump.
 *
 * Compares base ref (PR base SHA or origin/main) to HEAD.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PACKAGE_JSON = join(ROOT, "package.json");

const PRODUCT_PATH_PREFIXES = [
  "src/app/",
  "src/components/",
  "src/lib/",
  "prisma/",
  "public/",
];

const IGNORE_PATH_PREFIXES = [
  "src/__tests__/",
  "src/lib/match-fit-product-version",
  "scripts/bump-product-version.mjs",
  "scripts/verify-product-version-bump.mjs",
  "scripts/product-version-core.mjs",
  "docs/MATCH_FIT_PRODUCT_VERSION.md",
  "VERSION_HISTORY.md",
  ".cursor/rules/product-version.mdc",
];

function readPackageVersionFromRef(ref) {
  const raw = execSync(`git show ${ref}:package.json`, { cwd: ROOT, encoding: "utf8" });
  return JSON.parse(raw).version;
}

function readPackageVersionFromDisk() {
  return JSON.parse(readFileSync(PACKAGE_JSON, "utf8")).version;
}

function resolveBaseRef() {
  const fromEnv = process.env.MATCH_FIT_VERSION_BASE_REF?.trim();
  if (fromEnv) return fromEnv;

  try {
    const mergeBase = execSync("git merge-base HEAD origin/main", {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    if (mergeBase) return mergeBase;
  } catch {
    // fall through
  }

  return "origin/main";
}

function listChangedFiles(baseRef) {
  const out = execSync(`git diff --name-only ${baseRef}...HEAD`, {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  return out ? out.split("\n").filter(Boolean) : [];
}

function isProductFacingPath(path) {
  if (!PRODUCT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return false;
  }
  if (IGNORE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return false;
  }
  return true;
}

function main() {
  const baseRef = resolveBaseRef();
  const changed = listChangedFiles(baseRef);
  const productChanges = changed.filter(isProductFacingPath);

  if (productChanges.length === 0) {
    console.log("No product-facing paths changed; version bump not required.");
    return;
  }

  let baseVersion;
  try {
    baseVersion = readPackageVersionFromRef(baseRef);
  } catch {
    console.warn(`Could not read package.json at ${baseRef}; skipping version bump enforcement.`);
    return;
  }

  const headVersion = readPackageVersionFromDisk();
  if (baseVersion !== headVersion) {
    console.log(`Version bumped (${baseVersion} → ${headVersion}) for product-facing changes.`);
    return;
  }

  console.error(
    `Product-facing files changed without a package.json version bump (${baseVersion}).\n` +
      `Changed paths:\n${productChanges.map((p) => `  - ${p}`).join("\n")}\n\n` +
      `Run: npm run version:bump -- patch|minor|major --reason "…"\n` +
      `See docs/MATCH_FIT_PRODUCT_VERSION.md for categorization.`,
  );
  process.exit(1);
}

main();
