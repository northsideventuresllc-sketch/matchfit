/** Shared NI Brain text helpers (safe for unit tests; no server-only). */

const SECRET_PATTERNS: RegExp[] = [
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /(?:api[_-]?key|secret|password|token|service[_-]?role)\s*[:=]\s*\S+/gi,
  /sk_(?:live|test)_[A-Za-z0-9]+/g,
  /postgresql:\/\/[^\s]+/gi,
];

export function truncateNiBrainText(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Strip likely secrets before anything is sent to NI Brain. */
export function sanitizeForNiBrain(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[redacted]");
  }
  return out.trim();
}

export const MATCH_FIT_NI_TOOL_SLUG = "match-fit";
