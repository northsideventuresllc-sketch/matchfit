import { afterEach, describe, expect, it } from "vitest";
import {
  metaCapiEventNameForServerEvent,
  resolveMetaCapiCredentials,
} from "@/lib/server-conversion-tracking";

describe("server-conversion-tracking", () => {
  afterEach(() => {
    delete process.env.META_PIXEL_ID;
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.META_ADS_ACCESS_TOKEN;
  });

  it("maps internal funnel events to Meta standard CAPI names", () => {
    expect(metaCapiEventNameForServerEvent("client_signup_complete")).toBe("Subscribe");
    expect(metaCapiEventNameForServerEvent("trainer_signup_started")).toBe("Lead");
    expect(metaCapiEventNameForServerEvent("trainer_tos_accepted")).toBe("CompleteRegistration");
    expect(metaCapiEventNameForServerEvent("trainer_profile_complete")).toBe("CompleteRegistration");
    expect(metaCapiEventNameForServerEvent("client_membership_purchase")).toBe("Purchase");
    expect(metaCapiEventNameForServerEvent("client_vip_purchase")).toBe("Purchase");
    expect(metaCapiEventNameForServerEvent("trainer_service_purchase")).toBe("Purchase");
    expect(metaCapiEventNameForServerEvent("trainer_registration_fee_purchase")).toBe("Purchase");
    expect(metaCapiEventNameForServerEvent("trainer_promo_tokens_purchase")).toBe("Purchase");
    expect(metaCapiEventNameForServerEvent("fp_nudge_pack_purchase")).toBe("Purchase");
  });

  it("passes through unknown events unchanged", () => {
    expect(metaCapiEventNameForServerEvent("custom_operator_event")).toBe("custom_operator_event");
  });

  it("resolves dedicated CAPI token before ads fallback", () => {
    process.env.META_PIXEL_ID = "1033341912986790";
    process.env.META_ACCESS_TOKEN = "dedicated_token";
    process.env.META_ADS_ACCESS_TOKEN = "ads_token";
    expect(resolveMetaCapiCredentials()).toEqual({
      pixelId: "1033341912986790",
      accessToken: "dedicated_token",
      usedAdsTokenFallback: false,
    });
  });

  it("falls back to META_ADS_ACCESS_TOKEN when CAPI token unset", () => {
    process.env.META_PIXEL_ID = "1033341912986790";
    process.env.META_ADS_ACCESS_TOKEN = "ads_token";
    expect(resolveMetaCapiCredentials()).toEqual({
      pixelId: "1033341912986790",
      accessToken: "ads_token",
      usedAdsTokenFallback: true,
    });
  });

  it("returns null when pixel or token missing", () => {
    expect(resolveMetaCapiCredentials()).toBeNull();
    process.env.META_PIXEL_ID = "1033341912986790";
    expect(resolveMetaCapiCredentials()).toBeNull();
  });
});
