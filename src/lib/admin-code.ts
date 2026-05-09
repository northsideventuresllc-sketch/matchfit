/**
 * Staff administrator codes: first two letters of legal first name, first two of legal last name,
 * then month and day of birth as MM + DD (zero-padded).
 */
function lettersOnlyUpper(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z]/gi, "")
    .toUpperCase();
}

/** ISO date YYYY-MM-DD → MMDD used in admin codes. */
export function birthYmdToAdminCodeDigits(dateOfBirthYmd: string): string | null {
  const m = dateOfBirthYmd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[2]}${m[3]}`;
}

export function deriveAdministratorCode(
  firstName: string,
  lastName: string,
  dateOfBirthYmd: string,
): string | null {
  const fn = lettersOnlyUpper(firstName).slice(0, 2);
  const ln = lettersOnlyUpper(lastName).slice(0, 2);
  const dd = birthYmdToAdminCodeDigits(dateOfBirthYmd);
  if (fn.length < 2 || ln.length < 2 || !dd) return null;
  return `${fn}${ln}${dd}`;
}

export function normalizeAdministratorCodeInput(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Lowercase code persisted on {@link Administrator} rows (matches sign-in input normalization). */
export function canonicalAdministratorCode(
  firstName: string,
  lastName: string,
  dateOfBirthYmd: string,
): string | null {
  const raw = deriveAdministratorCode(firstName, lastName, dateOfBirthYmd);
  return raw ? raw.toLowerCase() : null;
}
