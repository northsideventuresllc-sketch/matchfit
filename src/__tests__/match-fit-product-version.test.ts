import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import {
  MATCH_FIT_PRODUCT_VERSION_ANNOUNCE,
  MATCH_FIT_PRODUCT_VERSION_LABEL,
} from "@/lib/match-fit-product-version";

describe("match-fit-product-version constants", () => {
  it("keeps the short homepage label in expected format", () => {
    expect(MATCH_FIT_PRODUCT_VERSION_LABEL).toMatch(/^BETA \d+\.\d+\.\d+$/);
  });

  it("keeps the long announcement format in expected semver-beta shape", () => {
    expect(MATCH_FIT_PRODUCT_VERSION_ANNOUNCE).toMatch(/^\d+\.\d+\.\d+-BETA$/);
  });

  it("keeps short and long labels aligned to the same semantic version", () => {
    const shortVersion = MATCH_FIT_PRODUCT_VERSION_LABEL.replace(/^BETA /, "");
    const [longVersion] = MATCH_FIT_PRODUCT_VERSION_ANNOUNCE.split("-");

    expect(longVersion).toBeTruthy();
    expect(shortVersion).toBe(longVersion);
  });

  it("derives labels from package.json version", () => {
    const core = packageJson.version.split("-")[0];
    expect(MATCH_FIT_PRODUCT_VERSION_LABEL).toBe(`BETA ${core}`);
    expect(MATCH_FIT_PRODUCT_VERSION_ANNOUNCE).toBe(`${core}-BETA`);
  });
});
