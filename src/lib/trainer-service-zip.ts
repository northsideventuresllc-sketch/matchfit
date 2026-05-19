import { isZipInBetaAtlantaMetroArea } from "@/lib/beta-atlanta-metro-zips";

/** Normalize US ZIP to 5 digits (or 5+4 with hyphen). */
export function normalizeTrainerServiceZip(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const digits = t.replace(/\D/g, "");
  if (digits.length < 5) return null;
  const five = digits.slice(0, 5);
  if (digits.length >= 9) {
    return `${five}-${digits.slice(5, 9)}`;
  }
  return five;
}

export function trainerServiceZipToPrefix(zip: string | null | undefined): string | null {
  const n = normalizeTrainerServiceZip(zip);
  if (!n) return null;
  const digits = n.replace(/\D/g, "");
  if (digits.length < 3) return null;
  return digits.slice(0, 3);
}

export function formatTrainerServiceZipLabel(zip: string | null | undefined): string | null {
  const n = normalizeTrainerServiceZip(zip);
  if (!n) return null;
  return isZipInBetaAtlantaMetroArea(n) ? `Atlanta metro · ${n}` : n;
}
