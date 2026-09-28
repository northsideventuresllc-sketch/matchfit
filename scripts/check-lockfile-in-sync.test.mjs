import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLockfileInSync, findDrift, loadJson } from './check-lockfile-in-sync.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('checkLockfileInSync: a dependency missing from the lockfile is flagged', () => {
  const pkg = { dependencies: { 'playwright-core': '^1.40.0' } };
  const lock = { packages: {} }; // pre-#329 shape: added to package.json, never re-locked
  const results = checkLockfileInSync(pkg, lock);
  assert.equal(results.length, 1);
  assert.equal(results[0].found, false);
  assert.deepEqual(findDrift(results).map((d) => d.name), ['playwright-core']);
});

test('checkLockfileInSync: a major-version mismatch is flagged', () => {
  const pkg = { dependencies: { sharp: '^0.33.0' } };
  const lock = { packages: { 'node_modules/sharp': { version: '0.32.6' } } };
  const results = checkLockfileInSync(pkg, lock);
  assert.equal(findDrift(results).length, 1);
});

test('checkLockfileInSync: a matching entry is not flagged', () => {
  const pkg = { dependencies: { sharp: '^0.33.0' } };
  const lock = { packages: { 'node_modules/sharp': { version: '0.33.5' } } };
  const results = checkLockfileInSync(pkg, lock);
  assert.equal(findDrift(results).length, 0);
});

test('checkLockfileInSync: a non-semver range (git/url/"*") is never flagged', () => {
  const pkg = { dependencies: { 'some-fork': 'github:org/repo#main' } };
  const lock = { packages: { 'node_modules/some-fork': { version: '0.0.0-main' } } };
  const results = checkLockfileInSync(pkg, lock);
  assert.equal(findDrift(results).length, 0);
});

test('regression: the REAL pre-#329 shape (playwright-core/sharp added, lockfile not regenerated) fails', () => {
  // Reproduces the actual MF-CI-LOCKFILE-DRIFT-0819 bug shape directly,
  // rather than only a synthetic fixture above.
  const pkg = {
    dependencies: {},
    devDependencies: { 'playwright-core': '^1.47.0', sharp: '^0.33.5' },
  };
  const lockBeforeFix = { packages: { '': {} } }; // neither dep ever made it into the lockfile
  const drift = findDrift(checkLockfileInSync(pkg, lockBeforeFix));
  assert.equal(drift.length, 2, 'both newly-added deps should be flagged as drifted, reproducing the CI-red bug');
});

test('the repo\'s OWN current package.json / package-lock.json pass this check right now', () => {
  const pkg = loadJson(path.join(ROOT, 'package.json'));
  const lock = loadJson(path.join(ROOT, 'package-lock.json'));
  const drift = findDrift(checkLockfileInSync(pkg, lock));
  assert.deepEqual(drift, [], `expected no lockfile drift, found: ${JSON.stringify(drift)}`);
});
