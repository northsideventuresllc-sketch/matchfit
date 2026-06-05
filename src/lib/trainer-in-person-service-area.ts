import { isZipInBetaAtlantaMetroArea } from "@/lib/beta-atlanta-metro-zips";
import { normalizeTrainerServiceZip } from "@/lib/trainer-service-zip";

/** US ZIP (5 digits or ZIP+4). */
export function isValidUsServiceZip(zip: string | null | undefined): boolean {
  const t = (zip ?? "").trim();
  return /^\d{5}(-\d{4})?$/.test(t);
}

/** During beta, in-person/mobile sessions are limited to the Atlanta metro service area. */
export function zipSupportsTrainerInPersonServices(zip: string | null | undefined): boolean {
  const normalized = normalizeTrainerServiceZip(zip);
  if (!normalized) return false;
  return isZipInBetaAtlantaMetroArea(normalized);
}

export const TRAINER_IN_PERSON_ATLANTA_ONLY_MESSAGE =
  "In-person sessions are available in the Atlanta metro area during beta. You can still sign up and coach virtually from anywhere in the U.S.";

export function inPersonServiceZipValidationError(zip: string | null | undefined): string | null {
  const normalized = normalizeTrainerServiceZip(zip);
  if (!normalized || !/^\d{5}(-\d{4})?$/.test(normalized)) {
    return "Enter a valid US ZIP code (5 digits or ZIP+4) for your in-person service area.";
  }
  if (!zipSupportsTrainerInPersonServices(normalized)) {
    return TRAINER_IN_PERSON_ATLANTA_ONLY_MESSAGE;
  }
  return null;
}
