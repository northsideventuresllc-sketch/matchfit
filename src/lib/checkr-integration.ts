import { getCheckrApiKey } from "@/lib/checkr";

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

export function getCheckrWorkLocationState(): string {
  return (process.env.CHECKR_WORK_LOCATION_STATE?.trim() || "GA").toUpperCase().slice(0, 2);
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
