/** Structured blocks from `buildAiMatchProfileText` output for dashboard display. */
export type AiMatchProfileDisplayBlock =
  | { kind: "kv"; title: string; value: string }
  | { kind: "list"; title: string; items: string[] }
  | { kind: "prose"; title: string; body: string };

/**
 * Normalizes in-person coverage for display, e.g. `15 mile radius of 30333`.
 * Accepts legacy text like `within 15 miles of US ZIP 30333`.
 */
/**
 * Removes the first `Services and rates:` bullet list from anywhere in the document (legacy compose
 * appended it after philosophy, which otherwise gets folded into the Coaching Philosophy prose block).
 */
export function stripServicesAndRatesSection(raw: string): { remainder: string; items: string[] | null } {
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.trim() !== "Services and rates:") continue;
    const items: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const L = lines[j]!;
      if (L.startsWith("- ")) {
        items.push(L.slice(2).trim());
        continue;
      }
      if (L.trim() === "") continue;
      break;
    }
    lines.splice(i, j - i);
    return { remainder: lines.join("\n"), items: items.length ? items : null };
  }
  return { remainder: raw, items: null };
}

export function formatInPersonCoverageForDisplay(raw: string): string {
  const t = raw.trim();
  const legacy = t.match(/^within\s+(\d+)\s*miles?\s+of\s+US\s*ZIP\s*(\d{5}(?:-\d{4})?)\s*\.?$/i);
  if (legacy) {
    return `${legacy[1]} mile radius of ${legacy[2]}`;
  }
  const modern = t.match(/^(\d+)\s*mile\s+radius\s+of\s+(\d{5}(?:-\d{4})?)\s*\.?$/i);
  if (modern) {
    return `${modern[1]} mile radius of ${modern[2]}`;
  }
  return t;
}

/**
 * Parses plain-text AI match profile into sections for a readable dashboard layout.
 * Tolerant of minor format drift (extra blank lines).
 */
export function parseAiMatchProfileForDisplay(raw: string): AiMatchProfileDisplayBlock[] {
  const { remainder, items: pulledServiceItems } = stripServicesAndRatesSection(raw);
  const lines = remainder.split(/\r?\n/);
  const blocks: AiMatchProfileDisplayBlock[] = [];
  let i = 0;

  while (i < lines.length && lines[i]?.trim() === "") i++;

  if (lines[i]?.startsWith("MATCH_FIT_TRAINER_MATCH_PROFILE")) {
    i++;
  }
  while (i < lines.length && lines[i]?.trim() === "") i++;

  const takeLine = (prefix: string): string | null => {
    while (i < lines.length && lines[i]?.trim() === "") i++;
    const line = lines[i];
    if (line == null) return null;
    if (line.startsWith(prefix)) {
      i++;
      return line.slice(prefix.length).trim();
    }
    return null;
  };

  const session = takeLine("Session formats:");
  if (session != null) {
    blocks.push({ kind: "kv", title: "Session Formats", value: session });
  }

  const coverage = takeLine("In-person coverage:");
  if (coverage != null && coverage.length) {
    blocks.push({
      kind: "kv",
      title: "In-Person Coverage",
      value: formatInPersonCoverageForDisplay(coverage),
    });
  }

  const years = takeLine("Years coaching:");
  if (years != null) {
    blocks.push({ kind: "kv", title: "Coaching Experience", value: years });
  }

  const ages = takeLine("Best age ranges:");
  if (ages != null) {
    blocks.push({ kind: "kv", title: "Preferred Clientele Age Groups", value: ages });
  }

  const levels = takeLine("Best client levels:");
  if (levels != null) {
    blocks.push({ kind: "kv", title: "Ideal Client Profile", value: levels });
  }

  const goals = takeLine("Primary client goals:");
  if (goals != null) {
    blocks.push({ kind: "kv", title: "Primary client goals", value: goals });
  }

  const langs = takeLine("Languages:");
  if (langs != null) {
    blocks.push({ kind: "kv", title: "Languages", value: langs });
  }

  while (i < lines.length && lines[i]?.trim() === "") i++;

  const philHeader = "Coaching philosophy (verbatim):";
  if (lines[i]?.startsWith(philHeader)) {
    const first = lines[i].slice(philHeader.length).trim();
    i++;
    const rest: string[] = [];
    if (first) rest.push(first);
    while (i < lines.length) {
      rest.push(lines[i]);
      i++;
    }
    const body = rest.join("\n").trim();
    if (body) {
      blocks.push({ kind: "prose", title: "Coaching Philosophy", body });
    }
  }

  if (blocks.length === 0 && remainder.trim()) {
    blocks.push({ kind: "prose", title: "Onboarding Questionnaire answers", body: remainder.trim() });
  }

  if (pulledServiceItems && pulledServiceItems.length > 0) {
    const sessionIdx = blocks.findIndex((b) => b.kind === "kv" && b.title === "Session Formats");
    const insertAt = sessionIdx >= 0 ? sessionIdx + 1 : 0;
    blocks.splice(insertAt, 0, { kind: "list", title: "Services and Rates", items: pulledServiceItems });
  }

  return blocks;
}
