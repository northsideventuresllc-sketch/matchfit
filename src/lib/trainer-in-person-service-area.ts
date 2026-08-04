import { normalizeTrainerServiceZip } from "@/lib/trainer-service-zip";

/**
 * In-person service area, worldwide.
 *
 * Match Fit went worldwide (JB decision, 2026-07-31). There is no metro allow-list
 * and no country allow-list: a coach declares where they work and that value is
 * accepted. The only requirement is that the value is usable as a postal code.
 *
 * Removed 2026-08-04, MF-ATLANTA-GATES-AFTER-WORLDWIDE (geo-guard:allow): the metro ZIP
 * allow-list that used to gate this. geo-guard:allow
 * It blocked every coach outside one US metro from listing in-person services.
 */

/** A usable service-area postal code (any country). */
export function isValidServicePostalCode(zip: string | null | undefined): boolean {
  return normalizeTrainerServiceZip(zip) !== null;
}

/** In-person coaching is supported wherever the coach says they work. */
export function zipSupportsTrainerInPersonServices(zip: string | null | undefined): boolean {
  return isValidServicePostalCode(zip);
}

export const TRAINER_IN_PERSON_SERVICE_AREA_REQUIRED_MESSAGE =
  "Enter the postal code you travel from for in-person sessions.";

export function inPersonServiceZipValidationError(zip: string | null | undefined): string | null {
  return isValidServicePostalCode(zip) ? null : TRAINER_IN_PERSON_SERVICE_AREA_REQUIRED_MESSAGE;
}
