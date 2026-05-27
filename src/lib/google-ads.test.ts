import { describe, expect, it, afterEach } from "vitest";
import { GOOGLE_ADS_ID, googleAdsConversionSendTo } from "./google-ads";

describe("googleAdsConversionSendTo", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("returns null when label env is unset", () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_SIGNUP_CONVERSION_LABEL;
    expect(googleAdsConversionSendTo("client_signup")).toBeNull();
  });

  it("prefixes bare conversion label with ads id", () => {
    process.env.NEXT_PUBLIC_GOOGLE_ADS_TRAINER_SIGNUP_CONVERSION_LABEL = "AbCdEfGh";
    expect(googleAdsConversionSendTo("trainer_signup")).toBe(`${GOOGLE_ADS_ID}/AbCdEfGh`);
  });

  it("passes through full send_to when env includes slash", () => {
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_SIGNUP_CONVERSION_LABEL = "AW-111/xyz";
    expect(googleAdsConversionSendTo("client_signup")).toBe("AW-111/xyz");
  });
});
