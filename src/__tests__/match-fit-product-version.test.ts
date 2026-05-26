import { describe, expect, it } from "vitest";
import {
  MATCH_FIT_PRODUCT_VERSION_ANNOUNCE,
  MATCH_FIT_PRODUCT_VERSION_LABEL,
} from "@/lib/match-fit-product-version";

describe("match-fit-product-version constants", () => {
  it("keeps the compact header label in 'BETA x.y.z' format", () => {
    expect(MATCH_FIT_PRODUCT_VERSION_LABEL).toMatch(/^BETA \d+\.\d+\.\d+$/);
  });

  it("keeps the long announcement string in 'x.y.z-BETA' format", () => {
    expect(MATCH_FIT_PRODUCT_VERSION_ANNOUNCE).toMatch(/^\d+\.\d+\.\d+-BETA$/);
  });

  it("uses the same semantic version in short and long formats", () => {
    const shortVersion = MATCH_FIT_PRODUCT_VERSION_LABEL.replace(/^BETA /, "");
    const longVersion = MATCH_FIT_PRODUCT_VERSION_ANNOUNCE.replace(/-BETA$/, "");

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
});
