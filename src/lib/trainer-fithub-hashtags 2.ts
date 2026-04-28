/** Normalize hashtag tokens: no #, lowercase, alphanumeric + underscore, max length each. */
const TAG_RE = /^[a-z0-9_]{1,48}$/;

export function normalizeHashtagToken(raw: string): string | null {
  const s = raw.trim().replace(/^#+/, "").toLowerCase();
  if (!s || !TAG_RE.test(s)) return null;
  return s;
}

export function parseHashtagListFromInput(input: string | undefined | null): string[] {
  if (!input?.trim()) return [];
  const parts = input.split(/[\s,]+/).map((p) => normalizeHashtagToken(p)).filter(Boolean) as string[];
  return [...new Set(parts)].slice(0, 30);
}

export function extractHashtagsFromCaption(caption: string | null | undefined): string[] {
  if (!caption?.trim()) return [];
  const matches = caption.match(/#[\w]+/g) ?? [];
  const out: string[] = [];
  for (const m of matches) {
    const t = normalizeHashtagToken(m);
    if (t) out.push(t);
  }
  return [...new Set(out)].slice(0, 30);
}

export function mergeHashtagLists(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].slice(0, 30);
}

export function parseStoredHashtagsJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.map((x) => (typeof x === "string" ? normalizeHashtagToken(x) : null)).filter(Boolean) as string[];
  } catch {
    return [];
  }
}
