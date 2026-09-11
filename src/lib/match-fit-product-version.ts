import packageJson from "@/../package.json";
import {
  formatMatchFitProductVersionAnnounce,
  formatMatchFitProductVersionLabel,
  parseMatchFitPackageVersion,
} from "@/lib/match-fit-product-version-core";

let rawVersion = "2.4.0-beta";
try {
  if (packageJson && typeof packageJson.version === "string") {
    rawVersion = packageJson.version;
  }
} catch {
  // fallback default
}

let parsed: ReturnType<typeof parseMatchFitPackageVersion>;
try {
  parsed = parseMatchFitPackageVersion(rawVersion);
} catch {
  parsed = { core: "2.4.0", parts: { major: 2, minor: 4, patch: 0 }, channel: "beta" };
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
