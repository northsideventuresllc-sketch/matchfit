import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatMetaInsightsOperatorError,
  getAdPlatformIntegrationStatus,
  getServerConversionIntegrationStatus,
  normalizeMetaAdAccountId,
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
      expect(status.spendSyncStatus).toBe("not_configured");
    }
  });

  it("treats Meta credentials alone as credentials_present, not Insights-ready", () => {
    process.env.META_ADS_ACCESS_TOKEN = "EAAG_test";
    process.env.META_AD_ACCOUNT_ID = "act_869068448935932";
    const meta = getAdPlatformIntegrationStatus().find((s) => s.platform === "meta");
    expect(meta?.configured).toBe(true);
    expect(meta?.spendSyncStatus).toBe("credentials_present");
    expect(meta?.spendSyncDetail).toMatch(/Insights must return costs/i);
  });

  it("marks Meta spend sync ready only after Insights probe succeeds", () => {
    process.env.META_ADS_ACCESS_TOKEN = "EAAG_test";
    process.env.META_AD_ACCOUNT_ID = "869068448935932";
    const meta = getAdPlatformIntegrationStatus({
      metaInsights: { ok: true, detail: "Insights OK for act_869068448935932." },
    }).find((s) => s.platform === "meta");
    expect(meta?.spendSyncStatus).toBe("insights_ok");
    expect(meta?.spendSyncDetail).toMatch(/Insights OK/);
  });

  it("surfaces Meta Insights errors instead of pretending API is connected", () => {
    process.env.META_ADS_ACCESS_TOKEN = "EAAG_test";
    process.env.META_AD_ACCOUNT_ID = "869068448935932";
    const meta = getAdPlatformIntegrationStatus({
      metaInsights: { ok: false, detail: "API access blocked. Use a Meta Business System User…" },
    }).find((s) => s.platform === "meta");
    expect(meta?.configured).toBe(true);
    expect(meta?.spendSyncStatus).toBe("insights_error");
    expect(meta?.spendSyncDetail).toMatch(/API access blocked/);
  });

  it("normalizes Meta ad account ids with or without act_ prefix", () => {
    expect(normalizeMetaAdAccountId("act_869068448935932")).toEqual({
      numericId: "869068448935932",
      actId: "act_869068448935932",
    });
    expect(normalizeMetaAdAccountId("869068448935932")?.actId).toBe("act_869068448935932");
    expect(normalizeMetaAdAccountId("not-an-id")).toBeNull();
  });

  it("formats Meta API access blocked with Marketing API / App Secret guidance", () => {
    const msg = formatMetaInsightsOperatorError("API access blocked.");
    expect(msg).toMatch(/Marketing API/i);
    expect(msg).toMatch(/Require App Secret|META_APP_SECRET/i);
    expect(msg).toMatch(/One ad account is fine/i);
  });

  it("reports server conversion integration status", () => {
    const status = getServerConversionIntegrationStatus();
    expect(status.metaCapi.configured).toBe(false);
    expect(status.metaCapi.capiSyncStatus).toBe("not_configured");
    expect(status.ga4.configured).toBe(false);
    expect(status.metaCapi.missingEnv).toContain("META_PIXEL_ID");
    expect(status.ga4.missingEnv).toContain("GA_MEASUREMENT_ID");
  });

  it("treats ads token as CAPI credentials fallback and honors live probe", () => {
    process.env.META_PIXEL_ID = "1033341912986790";
    process.env.META_ADS_ACCESS_TOKEN = "ads_token";
    const present = getServerConversionIntegrationStatus();
    expect(present.metaCapi.configured).toBe(true);
    expect(present.metaCapi.usedAdsTokenFallback).toBe(true);
    expect(present.metaCapi.capiSyncStatus).toBe("credentials_present");

    const ok = getServerConversionIntegrationStatus({
      metaCapiProbe: { ok: true, detail: "CAPI accepted probe.", usedAdsTokenFallback: true },
    });
    expect(ok.metaCapi.capiSyncStatus).toBe("capi_ok");

    const bad = getServerConversionIntegrationStatus({
      metaCapiProbe: { ok: false, detail: "API access blocked.", usedAdsTokenFallback: true },
    });
    expect(bad.metaCapi.capiSyncStatus).toBe("capi_error");
    expect(bad.metaCapi.configured).toBe(true);
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
