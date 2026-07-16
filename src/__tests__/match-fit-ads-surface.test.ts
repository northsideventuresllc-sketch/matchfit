import { describe, expect, it } from "vitest";
import {
  MATCH_FIT_DEFAULT_ADS_SURFACE_LABEL,
  MATCH_FIT_DEFAULT_ADS_SURFACE_PATH,
  isMatchFitDefaultAdsSurfacePath,
} from "@/lib/match-fit-ads-surface";

describe("match-fit-ads-surface", () => {
  it("declares admin Ad Tracking HQ as the default ads path", () => {
    expect(MATCH_FIT_DEFAULT_ADS_SURFACE_PATH).toBe("/admin/ad-tracking");
    expect(MATCH_FIT_DEFAULT_ADS_SURFACE_LABEL).toBe("Ad Tracking HQ");
  });

  it("recognizes the canonical path with optional query/trailing slash", () => {
    expect(isMatchFitDefaultAdsSurfacePath("/admin/ad-tracking")).toBe(true);
    expect(isMatchFitDefaultAdsSurfacePath("/admin/ad-tracking/")).toBe(true);
    expect(isMatchFitDefaultAdsSurfacePath("/admin/ad-tracking?days=7")).toBe(true);
    expect(isMatchFitDefaultAdsSurfacePath("/admin")).toBe(false);
    expect(isMatchFitDefaultAdsSurfacePath("/tools/ad-tracker")).toBe(false);
  });
});
