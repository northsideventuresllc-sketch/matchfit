/**
 * Validates a post-login redirect target: same-origin path only (no protocol-relative or external URLs).
 */
export function safeInternalNextPath(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (t.includes("\\")) return null;
  if (t.startsWith("/api/")) return null;
  return t;
}
