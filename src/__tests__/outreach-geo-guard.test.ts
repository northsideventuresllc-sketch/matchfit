import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Executable guard for NI-Brain Decision #342 (2026-07-27) — JB's THIRD correction on this.
 *
 * Match Fit recruiting is NATIONWIDE, online / virtual coaches only. No city, no metro,
 * no polygon, no lat/long — not in search, not in outreach copy, not in a code comment.
 *
 * This has regressed three times because every fix so far was a one-off edit with nothing
 * stopping the next one. This test is the stop. If a geo literal reappears anywhere in the
 * outreach / lead-sourcing layer, the suite fails and names the file and line.
 *
 * DELIBERATELY OUT OF SCOPE — these are legitimate and must keep working:
 *  - Social-post LOCATION TAGS (post metadata). Decision #342 allows Atlanta there, and
 *    only there.
 *  - (WITHDRAWN 2026-08-04) This guard used to declare the in-person service-area
 *    layer out of scope. That carve-out is exactly what let a metro ZIP allow-list
 *    keep gating signup and checkout after Match Fit went worldwide. The allow-list
 *    module is deleted; app-wide coverage now lives in atlanta-removed-guard.test.ts.
 */

const OUTREACH_DIR = join(process.cwd(), "src", "lib");

// Geo prose that must never drive lead sourcing or outbound copy.
const BANNED = [
  /atlanta/i,
  /\bgeorgia\b/i,
  /\bmidtown\b/i,
  /old fourth ward/i,
  /\bo4w\b/i,
  /inman park/i,
  /\bpolygon\b/i,
  /\blat(itude)?\s*[/,]\s*lon(gitude)?\b/i,
];

/**
 * `ATL_LOCAL` is a dead legacy enum value that still exists on historic lead rows
 * (see DEAD_LEGACY_TARGET_GROUPS in lead-taxonomy). The identifier itself is allowed —
 * what is banned is geo prose. Strip the bare token before scanning so the guard targets
 * real targeting language instead of a column value we cannot retroactively rename.
 */
function stripLegacyEnumToken(line: string): string {
  return line.replace(/ATL_LOCAL/g, "LEGACY_GROUP");
}

/**
 * Prose that documents compliance ("there is no polygon in this file") legitimately names
 * the banned terms. Such a line must opt out explicitly with a `geo-guard:allow` marker —
 * a deliberate, greppable exemption rather than a heuristic that could wave a real
 * violation through because the word "no" happened to appear on the same line.
 */
const ALLOW_MARKER = /geo-guard:allow/;

function outreachSourceFiles(): string[] {
  return readdirSync(OUTREACH_DIR)
    .filter((f) => f.startsWith("outreach") && f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(OUTREACH_DIR, f));
}

describe("outreach geo guard (NI-Brain Decision #342)", () => {
  it("scans a non-trivial number of outreach files", () => {
    // Guards the guard: if the glob silently stops matching, this test would pass vacuously.
    expect(outreachSourceFiles().length).toBeGreaterThan(20);
  });

  it("has no city, metro, polygon or lat/long literal in the outreach layer", () => {
    const violations: string[] = [];

    for (const file of outreachSourceFiles()) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((raw, i) => {
        if (ALLOW_MARKER.test(raw)) return;
        const line = stripLegacyEnumToken(raw);
        for (const pattern of BANNED) {
          if (pattern.test(line)) {
            violations.push(`${file.split("/src/")[1]}:${i + 1} → ${raw.trim()}`);
            break;
          }
        }
      });
    }

    expect(violations, `Geo targeting reintroduced into the outreach layer:\n${violations.join("\n")}`).toEqual(
      [],
    );
  });
});
