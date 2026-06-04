/** @typedef {"major" | "minor" | "patch"} MatchFitVersionBumpLevel */
/** @typedef {"beta" | null} MatchFitVersionChannel */

const SEMVER_CORE_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * @param {string} version
 */
export function parseMatchFitPackageVersion(version) {
  const trimmed = version.trim();
  const dash = trimmed.indexOf("-");
  const core = dash === -1 ? trimmed : trimmed.slice(0, dash);
  const prerelease = dash === -1 ? "" : trimmed.slice(dash + 1).trim().toLowerCase();

  const match = SEMVER_CORE_RE.exec(core);
  if (!match) {
    throw new Error(`Invalid Match Fit semver core "${core}" in package version "${version}".`);
  }

  const parts = {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };

  /** @type {MatchFitVersionChannel} */
  let channel = null;
  if (prerelease === "beta") {
    channel = "beta";
  } else if (prerelease.length > 0) {
    throw new Error(
      `Unsupported package.json prerelease "${prerelease}". Only "beta" or no prerelease is allowed without owner approval.`,
    );
  }

  return { core, parts, channel };
}

/**
 * @param {{ major: number; minor: number; patch: number }} parts
 * @param {MatchFitVersionChannel} channel
 */
export function formatMatchFitPackageVersion(parts, channel) {
  const core = `${parts.major}.${parts.minor}.${parts.patch}`;
  return channel === "beta" ? `${core}-beta` : core;
}

/**
 * @param {{ major: number; minor: number; patch: number }} parts
 * @param {MatchFitVersionBumpLevel} level
 */
export function bumpMatchFitSemverParts(parts, level) {
  switch (level) {
    case "major":
      return { major: parts.major + 1, minor: 0, patch: 0 };
    case "minor":
      return { major: parts.major, minor: parts.minor + 1, patch: 0 };
    case "patch":
      return { major: parts.major, minor: parts.minor, patch: parts.patch + 1 };
    default:
      throw new Error(`Unknown bump level: ${String(level)}`);
  }
}
