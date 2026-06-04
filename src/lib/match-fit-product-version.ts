import packageJson from "../../package.json";
import {
  formatMatchFitProductVersionAnnounce,
  formatMatchFitProductVersionLabel,
  parseMatchFitPackageVersion,
} from "@/lib/match-fit-product-version-core";

const parsed = parseMatchFitPackageVersion(packageJson.version);

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
