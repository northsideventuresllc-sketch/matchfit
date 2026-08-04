import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Executable guard for MF-ATLANTA-GATES-AFTER-WORLDWIDE (JB decision, 2026-08-04).
 *
 * Match Fit went worldwide. Atlanta is removed entirely — not as a gate, not as a
 * default, not as a cap, not as a copy string, not as a label.
 *
 * The existing outreach geo guard (outreach-geo-guard.test.ts) only ever scanned
 * `src/lib/outreach*.ts`, and its own docblock explicitly declared the in-person
 * service-area layer OUT of scope. That carve-out is what let an Atlanta-metro ZIP
 * allow-list keep gating trainer signup and client checkout for a week after the
 * worldwide switch. This guard scans the whole app so there is no carve-out left.
 *
 * Legitimately exempt, by path, with reasons:
 *  - terms / privacy pages: NVG LLC's real registered address and the governing-law
 *    clause. Corporate facts, not product geography.
 *  - demography options: the complete US state list used by a dropdown.
 * Any other file that must name the term marks the individual line `geo-guard:allow`.
 */

const SRC = join(process.cwd(), "src");

const EXEMPT_FILES = new Set([
  "app/terms/page.tsx",
  "app/privacy/page.tsx",
  "lib/trainer-profile-demography-options.ts",
]);

const SKIP_DIRS = new Set(["__tests__", "generated", "node_modules"]);

/** Atlanta-specific geography. None of this may drive product behaviour or copy. */
const BANNED = [
  /atlanta/i,
  /\bbuckhead\b/i,
  /old fourth ward/i,
  /\bo4w\b/i,
  /inman park/i,
  /\bsandy springs\b/i,
  /\balpharetta\b/i,
  /\bmarietta\b/i,
  /metro[-_ ]?atl\b/i,
];

const ALLOW_MARKER = /geo-guard:allow/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
    if (EXEMPT_FILES.has(relative(SRC, full))) continue;
    out.push(full);
  }
  return out;
}

describe("Atlanta removed — worldwide guard (2026-08-04)", () => {
  it("scans the whole app, not one folder", () => {
    // Guards the guard: a broken walk would make every assertion below vacuous.
    expect(walk(SRC).length).toBeGreaterThan(300);
  });

  it("has no Atlanta geography anywhere in application code", () => {
    const violations: string[] = [];

    for (const file of walk(SRC)) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((raw, i) => {
          if (ALLOW_MARKER.test(raw)) return;
          if (BANNED.some((p) => p.test(raw))) {
            violations.push(`${relative(SRC, file)}:${i + 1} → ${raw.trim()}`);
          }
        });
    }

    expect(
      violations,
      `Atlanta reintroduced after the worldwide switch:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("has no Atlanta-metro ZIP allow-list module", () => {
    const libFiles = readdirSync(join(SRC, "lib"));
    expect(libFiles.filter((f) => /atlanta/i.test(f))).toEqual([]);
  });

  it("exposes no location-derived beta capacity", async () => {
    const pool = await import("@/lib/beta-trainer-pool");
    expect(Object.keys(pool).filter((k) => /atlanta/i.test(k))).toEqual([]);

    const config = await import("@/lib/beta-launch-config");
    expect(Object.keys(config).filter((k) => /atlanta/i.test(k))).toEqual([]);
  });

  it("accepts in-person service areas outside the US", async () => {
    const { inPersonServiceZipValidationError } = await import("@/lib/trainer-in-person-service-area");
    for (const postal of ["SW1A 1AA", "M5V 3L9", "75008", "2000", "100-0001"]) {
      expect(inPersonServiceZipValidationError(postal)).toBeNull();
    }
  });
});
