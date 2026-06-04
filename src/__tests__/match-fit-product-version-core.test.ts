import { describe, expect, it } from "vitest";
import {
  bumpMatchFitSemverParts,
  formatMatchFitPackageVersion,
  formatMatchFitProductVersionAnnounce,
  formatMatchFitProductVersionLabel,
  parseMatchFitPackageVersion,
} from "@/lib/match-fit-product-version-core";

describe("match-fit-product-version-core", () => {
  it("parses beta package versions", () => {
    expect(parseMatchFitPackageVersion("1.1.1-beta")).toEqual({
      core: "1.1.1",
      parts: { major: 1, minor: 1, patch: 1 },
      channel: "beta",
    });
  });

  it("parses GA package versions without prerelease", () => {
    expect(parseMatchFitPackageVersion("2.0.0")).toEqual({
      core: "2.0.0",
      parts: { major: 2, minor: 0, patch: 0 },
      channel: null,
    });
  });

  it("rejects unknown prerelease tags", () => {
    expect(() => parseMatchFitPackageVersion("1.0.0-rc.1")).toThrow(/owner approval/i);
  });

  it("bumps semver levels and preserves channel formatting", () => {
    const base = parseMatchFitPackageVersion("1.1.1-beta").parts;
    expect(formatMatchFitPackageVersion(bumpMatchFitSemverParts(base, "patch"), "beta")).toBe("1.1.2-beta");
    expect(formatMatchFitPackageVersion(bumpMatchFitSemverParts(base, "minor"), "beta")).toBe("1.2.0-beta");
    expect(formatMatchFitPackageVersion(bumpMatchFitSemverParts(base, "major"), "beta")).toBe("2.0.0-beta");
  });

  it("formats user-facing labels for beta and GA", () => {
    expect(formatMatchFitProductVersionLabel("1.2.3", "beta")).toBe("BETA 1.2.3");
    expect(formatMatchFitProductVersionLabel("1.2.3", null)).toBe("1.2.3");
    expect(formatMatchFitProductVersionAnnounce("1.2.3", "beta")).toBe("1.2.3-BETA");
    expect(formatMatchFitProductVersionAnnounce("1.2.3", null)).toBe("1.2.3");
  });
});
