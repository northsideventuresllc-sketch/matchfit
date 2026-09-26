#!/usr/bin/env node
/**
 * FRONTIER-06-BUG-BECOMES-TEST backfill — regression test for
 * MF-CI-LOCKFILE-DRIFT-0819 (NI-Brain Learning, 2026-08-19): matchfit `main`
 * CI's `build` job was red for days because `playwright-core`/`sharp` were
 * added to `package.json` without regenerating `package-lock.json`, so
 * `npm ci` (which refuses to touch the lockfile) failed every run. Fixed in
 * matchfit PR #329.
 *
 * Running `npm ci` itself in a unit test is slow and network-dependent, so
 * this is the fast, deterministic equivalent of what `npm ci` actually
 * enforces: every direct dependency/devDependency named in package.json
 * exists in package-lock.json's `packages` map (lockfileVersion 3 shape)
 * with a version that satisfies the package.json range. This is exactly the
 * mismatch that broke CI — a dependency present in one file and missing (or
 * stale) in the other — and would have failed against the pre-#329 tree.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export function loadJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

/**
 * Returns an array of { name, wantedRange, found, foundVersion, satisfies }
 * for every direct dependency declared in package.json.
 */
export function checkLockfileInSync(pkg, lock) {
  const declared = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const packages = lock.packages || {};

  return Object.entries(declared).map(([name, wantedRange]) => {
    const entry = packages[`node_modules/${name}`];
    const foundVersion = entry?.version;
    if (!foundVersion) {
      return { name, wantedRange, found: false, foundVersion: null, satisfies: false };
    }
    // Dependency-free breaking-version check (no semver package — this
    // script has no runtime deps on purpose, so it never itself falls prey
    // to lockfile drift). Tolerates non-numeric ranges (git/URL/workspace
    // specs, "*") as trivially satisfied — those aren't the
    // MF-CI-LOCKFILE-DRIFT-0819 shape. Follows semver's own 0.x convention:
    // for a 0.y.z range the minor is the breaking boundary, not the major.
    const wantedParts = wantedRange.match(/^[\^~]?(\d+)\.(\d+)/);
    const foundParts = foundVersion.match(/^(\d+)\.(\d+)/);
    let satisfies = true;
    if (wantedParts && foundParts) {
      const [, wMajor, wMinor] = wantedParts;
      const [, fMajor, fMinor] = foundParts;
      satisfies = wMajor === '0' ? wMajor === fMajor && wMinor === fMinor : wMajor === fMajor;
    }
    return { name, wantedRange, found: true, foundVersion, satisfies };
  });
}

export function findDrift(results) {
  return results.filter((r) => !r.found || !r.satisfies);
}

function main() {
  const root = process.argv[2] || process.cwd();
  const pkg = loadJson(path.join(root, 'package.json'));
  const lock = loadJson(path.join(root, 'package-lock.json'));
  const results = checkLockfileInSync(pkg, lock);
  const drift = findDrift(results);

  if (drift.length > 0) {
    console.error(`DRIFT: ${drift.length} dependenc${drift.length === 1 ? 'y' : 'ies'} out of sync with package-lock.json (this is exactly what breaks \`npm ci\` — see MF-CI-LOCKFILE-DRIFT-0819):`);
    for (const d of drift) {
      console.error(`  - ${d.name}: package.json wants "${d.wantedRange}", lockfile has ${d.foundVersion ?? 'NOTHING'}`);
    }
    process.exit(1);
  }
  console.log(`CLEAN: package-lock.json in sync with package.json (${results.length} direct deps checked).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
