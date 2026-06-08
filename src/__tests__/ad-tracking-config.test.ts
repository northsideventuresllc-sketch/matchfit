import { describe, expect, it } from "vitest";
import {
  AD_LANDING_PATHS,
  AD_TRACKING_EVENTS,
  AD_UTM_PRESETS,
  buildTrackedAdUrl,
  googleAdsConversionEnvKey,
} from "@/lib/ad-tracking-config";

describe("ad-tracking-config", () => {
  it("builds tracked URLs with UTM params on landing paths", () => {
    const url = buildTrackedAdUrl({
      baseUrl: "https://match-fit.net",
      funnel: "client",
      utm_source: "facebook",
      utm_medium: "paid_social",
      utm_campaign: "client_beta_launch",
      utm_content: "carousel_a",
    });

    expect(url).toBe(
      "https://match-fit.net/client/sign-up?utm_source=facebook&utm_medium=paid_social&utm_campaign=client_beta_launch&utm_content=carousel_a",
    );
    expect(AD_LANDING_PATHS.client.path).toBe("/client/sign-up");
  });

  it("maps conversion goals to Google env keys", () => {
    expect(googleAdsConversionEnvKey("client_signup")).toBe(
      "NEXT_PUBLIC_GOOGLE_ADS_CLIENT_SIGNUP_CONVERSION_LABEL",
    );
    expect(googleAdsConversionEnvKey("trainer_signup")).toBe(
      "NEXT_PUBLIC_GOOGLE_ADS_TRAINER_SIGNUP_CONVERSION_LABEL",
    );
  });

  it("includes pixel-aligned conversion events", () => {
    const client = AD_TRACKING_EVENTS.find((e) => e.id === "client_signup");
    const trainer = AD_TRACKING_EVENTS.find((e) => e.id === "trainer_signup");
    expect(client?.metaEvent).toBe("Subscribe");
    expect(client?.googleConversionKind).toBe("client_signup");
    expect(trainer?.metaEvent).toBe("CompleteRegistration");
    expect(trainer?.googleConversionKind).toBe("trainer_signup");
  });

  it("ships UTM presets for both platforms", () => {
    expect(AD_UTM_PRESETS.some((p) => p.platform === "meta")).toBe(true);
    expect(AD_UTM_PRESETS.some((p) => p.platform === "google")).toBe(true);
  });
});
