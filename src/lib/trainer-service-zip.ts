/**
 * Service-area postal codes, worldwide.
 *
 * Match Fit is worldwide (JB decision, 2026-07-31). No country and no metro is
 * privileged here: a coach's service area is whatever postal code they supply.
 * US ZIP / ZIP+4 keeps its canonical shape for backwards compatibility with rows
 * written before the worldwide switch; every other country's format is preserved
 * as typed (trimmed, single-spaced, uppercased).
 */
export function normalizeTrainerServiceZip(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!t) return null;

  const digits = t.replace(/\D/g, "");
  const digitsOnly = /^[\d\s-]+$/.test(t);

  // US ZIP / ZIP+4 shape (unchanged from the pre-worldwide behaviour).
  if (digitsOnly && digits.length >= 5) {
    const five = digits.slice(0, 5);
    return digits.length >= 9 ? `${five}-${digits.slice(5, 9)}` : five;
  }

  // Any other postal format in the world: 3+ characters, kept as supplied.
  return t.length >= 3 ? t : null;
}

/**
 * Coarse regional bucket for featured placement: leading digits of a numeric
 * postal code. Returns null for postal systems that are not digit-led — those
 * coaches simply have no regional bucket rather than being excluded anywhere.
 */
export function trainerServiceZipToPrefix(zip: string | null | undefined): string | null {
  const n = normalizeTrainerServiceZip(zip);
  if (!n) return null;
  const digits = n.replace(/\D/g, "");
  if (digits.length < 3) return null;
  return digits.slice(0, 3);
}

/** Display label for a coach's service area. Neutral: no metro is named or ranked. */
export function formatTrainerServiceZipLabel(zip: string | null | undefined): string | null {
  return normalizeTrainerServiceZip(zip);
}
