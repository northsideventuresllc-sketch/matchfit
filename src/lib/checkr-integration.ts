import { getCheckrApiKey } from "@/lib/checkr-config";

/** Production Checkr API; staging uses CHECKR_API_BASE override. */
export const CHECKR_API_DEFAULT_BASE = "https://api.checkr.com/v1";

export function getCheckrApiBase(): string {
  const raw = process.env.CHECKR_API_BASE?.trim();
  return raw || CHECKR_API_DEFAULT_BASE;
}

export function getCheckrPackageSlug(): string | null {
  const slug = process.env.CHECKR_PACKAGE_SLUG?.trim();
  return slug || null;
}

/**
 * Operator-supplied work location for Checkr. No default region.
 *
 * Removed 2026-08-04, MF-ATLANTA-GATES-AFTER-WORLDWIDE (geo-guard:allow): the `"GA"`
 * fallback, which stamped every background check with a Georgia work location
 * regardless of where the coach actually works. Set CHECKR_WORK_LOCATION_STATE
 * (and CHECKR_WORK_LOCATION_COUNTRY where not US) per deployment.
 */
export function getCheckrWorkLocationState(): string | null {
  const raw = process.env.CHECKR_WORK_LOCATION_STATE?.trim();
  return raw ? raw.toUpperCase().slice(0, 2) : null;
}

/** ISO country for Checkr work location; defaults to US because Checkr is a US-scoped vendor. */
export function getCheckrWorkLocationCountry(): string {
  const raw = process.env.CHECKR_WORK_LOCATION_COUNTRY?.trim();
  return (raw || "US").toUpperCase().slice(0, 2);
}

export function getCheckrWorkLocationCity(): string | null {
  const city = process.env.CHECKR_WORK_LOCATION_CITY?.trim();
  return city || null;
}

/**
 * Fully automated Checkr invitations (API + package). When false, Plan B manual invite flow is used.
 */
export function isCheckrApiFullyConfigured(): boolean {
  return Boolean(getCheckrApiKey() && getCheckrPackageSlug());
}

/** Plan B backup when Checkr API is not wired or forced via env. */
export function isBackgroundCheckPlanBActive(): boolean {
  const force = process.env.MATCH_FIT_CHECKR_PLAN_B?.trim().toLowerCase();
  if (force === "1" || force === "true" || force === "yes") return true;
  return !isCheckrApiFullyConfigured();
}
