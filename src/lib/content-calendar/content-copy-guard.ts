/**
 * Content copy guard — the single place that catches product-truth violations in GENERATED social
 * copy before it reaches the operator. Two classes of issue:
 *
 *  1. Geography ("block"): Match Fit is WORLDWIDE. "nationwide", "across the country", "USA only"
 *     etc. are objectively wrong and are soft-rewritten to worldwide-safe language. (Standing
 *     rule 6 — the app went worldwide; no geo hook anywhere.)
 *  2. Internal brand term ("warn"): leading with "Fitness Pro" in public copy reads as our jargon
 *     before the brand is established (JB 2026-09-03). This is a WARNING only — we do not rewrite
 *     the operator's or model's wording, we just surface it so the generator can prefer trending
 *     terms ("coach", "trainer", "personal trainer").
 *
 * Pure module (no server-only imports) so it is unit-testable and usable on both sides.
 */

export type ContentCopyIssueKind = "geo" | "internal_term";
export type ContentCopyIssueSeverity = "block" | "warn";

export type ContentCopyIssue = {
  kind: ContentCopyIssueKind;
  severity: ContentCopyIssueSeverity;
  match: string;
};

/** Geo phrases that contradict "Match Fit is worldwide" → each maps to a worldwide-safe rewrite. */
const GEO_REWRITES: ReadonlyArray<{ re: RegExp; to: string }> = [
  { re: /\bnation[-\s]?wide\b/gi, to: "worldwide" },
  { re: /\bacross the (?:country|nation)\b/gi, to: "around the world" },
  { re: /\bcoast[-\s]?to[-\s]?coast\b/gi, to: "worldwide" },
  { re: /\ball across the u\.?s\.?a?\.?\b/gi, to: "all around the world" },
  { re: /\b(?:u\.?s\.?a?\.?|united states)[-\s]?(?:only|based|wide)\b/gi, to: "worldwide" },
];

/** Detect a public caption that LEADS with the internal "Fitness Pro" term (first ~60 chars). */
const LEADS_WITH_FITNESS_PRO = /^[^.!?\n]{0,60}\bfitness\s*pros?\b/i;

/** Rewrites the objective geo violations to worldwide-safe wording. Leaves everything else intact. */
export function softFixContentCopy(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { re, to } of GEO_REWRITES) {
    out = out.replace(re, (m) => matchCase(m, to));
  }
  return out;
}

/** Reports issues without changing the text. `severity: "block"` = geo, `"warn"` = internal term. */
export function scanContentCopy(text: string): ContentCopyIssue[] {
  const issues: ContentCopyIssue[] = [];
  if (!text) return issues;
  for (const { re } of GEO_REWRITES) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
      issues.push({ kind: "geo", severity: "block", match: m[0] });
    }
  }
  const lead = text.trim().match(LEADS_WITH_FITNESS_PRO);
  if (lead) issues.push({ kind: "internal_term", severity: "warn", match: lead[0].trim() });
  return issues;
}

/** True when copy still contains a hard geo violation after soft-fixing — used by the build guard test. */
export function hasBlockingContentCopyIssue(text: string): boolean {
  return scanContentCopy(softFixContentCopy(text)).some((i) => i.severity === "block");
}

/** Preserve simple ALL-CAPS / Capitalized casing when substituting a replacement word. */
function matchCase(source: string, replacement: string): string {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
