/**
 * Canonical Match Fit paid-ads operator surface.
 *
 * Admin Ad Tracking HQ (`/admin/ad-tracking`) is the default place to plan
 * campaigns, confirm pixels/tags, build UTM links, register spend, and sync
 * Meta/Google/TikTok performance. Cross-venture AXON trackers are secondary.
 */

export const MATCH_FIT_DEFAULT_ADS_SURFACE_PATH = "/admin/ad-tracking" as const;

export const MATCH_FIT_DEFAULT_ADS_SURFACE_LABEL = "Ad Tracking HQ" as const;

export function isMatchFitDefaultAdsSurfacePath(pathname: string): boolean {
  const path = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
  return path === MATCH_FIT_DEFAULT_ADS_SURFACE_PATH;
}
