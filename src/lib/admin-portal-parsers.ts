/** Pure helpers for admin dashboard parsing (safe for unit tests). */

export function parseTopOffering(serviceOfferingsJson: string | null): string | null {
  if (!serviceOfferingsJson) return null;
  try {
    const parsed = JSON.parse(serviceOfferingsJson) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const first = parsed[0] as { title?: string; name?: string };
    return first.title?.trim() || first.name?.trim() || null;
  } catch {
    return null;
  }
}
