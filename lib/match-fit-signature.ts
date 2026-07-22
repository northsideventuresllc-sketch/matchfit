/**
 * Locked Match Fit email signature (MF-SIG).
 * Source: JB standing brand rule — Sincerely / JB / Founder of Match Fit /
 * Part of the NORTHSiDE Intelligence Ecosystem / match-fit.net / (E): jb@match-fit.net.
 * Do not reword without JB approval. `NORTHSiDE` casing preserved in the ecosystem line.
 */

export const MATCH_FIT_SIGNATURE_FROM_EMAIL = "jb@match-fit.net";

export const MATCH_FIT_SIGNATURE_LINES = [
  "Sincerely",
  "JB",
  "Founder of Match Fit",
  "Part of the NORTHSiDE Intelligence Ecosystem",
  "match-fit.net",
  "(E): jb@match-fit.net",
] as const;

/** Plain-text signature block for pasteable email bodies. */
export function matchFitSignatureText(): string {
  return MATCH_FIT_SIGNATURE_LINES.join("\n");
}
