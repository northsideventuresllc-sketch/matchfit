import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAdPlatformIntegrationStatus,
  getServerConversionIntegrationStatus,
  parseMetaConversions,
} from "@/lib/ad-platform-performance";

const envSnapshot = { ...process.env };

describe("ad-platform-performance", () => {
  beforeEach(() => {
    process.env = { ...envSnapshot };
    delete process.env.META_ADS_ACCESS_TOKEN;
    delete process.env.META_AD_ACCOUNT_ID;
    delete process.env.GOOGLE_ADS_CUSTOMER_ID;
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    delete process.env.GOOGLE_ADS_CLIENT_ID;
    delete process.env.GOOGLE_ADS_CLIENT_SECRET;
    delete process.env.GOOGLE_ADS_REFRESH_TOKEN;
    delete process.env.TIKTOK_ADS_ACCESS_TOKEN;
    delete process.env.TIKTOK_ADS_ADVERTISER_ID;
    delete process.env.META_PIXEL_ID;
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.GA_MEASUREMENT_ID;
    delete process.env.GA_API_SECRET;
  });

  afterEach(() => {
    process.env = envSnapshot;
  });

  it("reports missing env vars when integrations are not configured", () => {
    const statuses = getAdPlatformIntegrationStatus();
    expect(statuses).toHaveLength(3);
    expect(statuses.map((s) => s.platform)).toEqual(["meta", "google", "tiktok"]);
    for (const status of statuses) {
      expect(status.configured).toBe(false);
      expect(status.missingEnv.length).toBeGreaterThan(0);
    }
  });

  it("reports server conversion integration status", () => {
    const status = getServerConversionIntegrationStatus();
    expect(status.metaCapi.configured).toBe(false);
    expect(status.ga4.configured).toBe(false);
    expect(status.metaCapi.missingEnv).toContain("META_PIXEL_ID");
    expect(status.ga4.missingEnv).toContain("GA_MEASUREMENT_ID");
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
