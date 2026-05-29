import packageJson from "../../package.json";

/** Core semver from package.json (e.g. `1.1.1-beta` → `1.1.1`). */
function coreSemverFromPackageVersion(version: string): string {
  const trimmed = version.trim();
  const dash = trimmed.indexOf("-");
  return dash === -1 ? trimmed : trimmed.slice(0, dash);
}

const CORE_VERSION = coreSemverFromPackageVersion(packageJson.version);

/** User-facing product version shown in headers and beta copy. */
export const MATCH_FIT_PRODUCT_VERSION_LABEL = `BETA ${CORE_VERSION}`;

/** Long-form version string for in-product announcements. */
export const MATCH_FIT_PRODUCT_VERSION_ANNOUNCE = `${CORE_VERSION}-BETA`;
