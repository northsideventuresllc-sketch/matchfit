import packageJson from "../../package.json";
import {
  formatMatchFitProductVersionAnnounce,
  formatMatchFitProductVersionLabel,
  parseMatchFitPackageVersion,
} from "@/lib/match-fit-product-version-core";

/** Safe fallback if `package.json`'s `version` field is ever missing or malformed at runtime
 *  (e.g. a stripped/partial build artifact) — keeps the homepage and headers rendering with a
 *  clearly-labeled version instead of throwing and taking down SSR. */
const FALLBACK_VERSION = "0.0.0-beta";

let parsed: ReturnType<typeof parseMatchFitPackageVersion>;
try {
  parsed = parseMatchFitPackageVersion(packageJson.version);
} catch (e) {
  console.error("[match-fit-product-version] failed to parse package.json version:", e);
  parsed = parseMatchFitPackageVersion(FALLBACK_VERSION);
}

/** Canonical semver core (no channel), sourced from `package.json`. */
export const MATCH_FIT_PRODUCT_VERSION_CORE = parsed.core;

/** `beta` while in beta; `null` after owner-approved GA (no `BETA` prefix in UI). */
export const MATCH_FIT_PRODUCT_VERSION_CHANNEL = parsed.channel;

/** User-facing product version shown in headers and beta copy. */
export const MATCH_FIT_PRODUCT_VERSION_LABEL = formatMatchFitProductVersionLabel(
  parsed.core,
  parsed.channel,
);

/** Long-form version string for in-product announcements. */
export const MATCH_FIT_PRODUCT_VERSION_ANNOUNCE = formatMatchFitProductVersionAnnounce(
  parsed.core,
  parsed.channel,
);
