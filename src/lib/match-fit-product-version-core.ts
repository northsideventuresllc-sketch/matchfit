export type MatchFitVersionChannel = "beta" | null;

export type MatchFitSemverParts = {
  major: number;
  minor: number;
  patch: number;
};

export type ParsedMatchFitPackageVersion = {
  core: string;
  parts: MatchFitSemverParts;
  channel: MatchFitVersionChannel;
};

export type MatchFitVersionBumpLevel = "major" | "minor" | "patch";

const SEMVER_CORE_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/** Parse `package.json` version (e.g. `1.2.3-beta` → core `1.2.3`, channel `beta`). */
export function parseMatchFitPackageVersion(version: string): ParsedMatchFitPackageVersion {
  const trimmed = version.trim();
  const dash = trimmed.indexOf("-");
  const core = dash === -1 ? trimmed : trimmed.slice(0, dash);
  const prerelease = dash === -1 ? "" : trimmed.slice(dash + 1).trim().toLowerCase();

  const match = SEMVER_CORE_RE.exec(core);
  if (!match) {
    throw new Error(`Invalid Match Fit semver core "${core}" in package version "${version}".`);
  }

  const parts: MatchFitSemverParts = {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };

  let channel: MatchFitVersionChannel = null;
  if (prerelease === "beta") {
    channel = "beta";
  } else if (prerelease.length > 0) {
    throw new Error(
      `Unsupported package.json prerelease "${prerelease}". Only "beta" or no prerelease is allowed without owner approval.`,
    );
  }

  return { core, parts, channel };
}

export function formatMatchFitPackageVersion(
  parts: MatchFitSemverParts,
  channel: MatchFitVersionChannel,
): string {
  const core = `${parts.major}.${parts.minor}.${parts.patch}`;
  return channel === "beta" ? `${core}-beta` : core;
}

export function bumpMatchFitSemverParts(
  parts: MatchFitSemverParts,
  level: MatchFitVersionBumpLevel,
): MatchFitSemverParts {
  switch (level) {
    case "major":
      return { major: parts.major + 1, minor: 0, patch: 0 };
    case "minor":
      return { major: parts.major, minor: parts.minor + 1, patch: 0 };
    case "patch":
      return { major: parts.major, minor: parts.minor, patch: parts.patch + 1 };
    default: {
      const _exhaustive: never = level;
      throw new Error(`Unknown bump level: ${String(_exhaustive)}`);
    }
  }
}

/** Short label shown in dashboards and footers: `BETA 1.2.3` or `1.2.3`. */
export function formatMatchFitProductVersionLabel(
  core: string,
  channel: MatchFitVersionChannel,
): string {
  return channel === "beta" ? `BETA ${core}` : core;
}

/** Long label for promo/announcement copy: `1.2.3-BETA` or `1.2.3`. */
export function formatMatchFitProductVersionAnnounce(
  core: string,
  channel: MatchFitVersionChannel,
): string {
  return channel === "beta" ? `${core}-BETA` : core;
}
