import { describe, expect, it } from "vitest";
import {
  getAdPlatformIntegrationStatus,
  parseMetaConversions,
} from "@/lib/ad-platform-performance";

describe("ad-platform-performance", () => {
  it("reports missing env vars when integrations are not configured", () => {
    const statuses = getAdPlatformIntegrationStatus();
    expect(statuses).toHaveLength(2);
    expect(statuses.map((s) => s.platform)).toEqual(["meta", "google"]);
    for (const status of statuses) {
      expect(status.configured).toBe(false);
      expect(status.missingEnv.length).toBeGreaterThan(0);
    }
  });

  it("sums pixel conversion action types from Meta insights", () => {
    const total = parseMetaConversions([
      { action_type: "offsite_conversion.fb_pixel_subscribe", value: "3" },
      { action_type: "link_click", value: "99" },
      { action_type: "lead", value: "2" },
    ]);
    expect(total).toBe(5);
  });
});
