import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { metaAppSecretProof, maybeMetaAppSecretProof, withMetaGraphAuth } from "@/lib/meta-graph";

const envSnapshot = { ...process.env };

describe("meta-graph", () => {
  beforeEach(() => {
    process.env = { ...envSnapshot };
    delete process.env.META_APP_SECRET;
  });

  afterEach(() => {
    process.env = envSnapshot;
  });

  it("builds appsecret_proof as HMAC-SHA256 of the access token", () => {
    const proof = metaAppSecretProof("EAAG_token", "app_secret_value");
    expect(proof).toMatch(/^[a-f0-9]{64}$/);
    expect(metaAppSecretProof("EAAG_token", "app_secret_value")).toBe(proof);
    expect(metaAppSecretProof("other", "app_secret_value")).not.toBe(proof);
  });

  it("omits proof when META_APP_SECRET is unset", () => {
    expect(maybeMetaAppSecretProof("EAAG_token")).toBeNull();
    const url = withMetaGraphAuth(new URL("https://graph.facebook.com/v21.0/me"), "EAAG_token");
    expect(url.searchParams.get("access_token")).toBe("EAAG_token");
    expect(url.searchParams.get("appsecret_proof")).toBeNull();
  });

  it("adds appsecret_proof when META_APP_SECRET is set", () => {
    process.env.META_APP_SECRET = "app_secret_value";
    const url = withMetaGraphAuth(new URL("https://graph.facebook.com/v21.0/me"), "EAAG_token");
    expect(url.searchParams.get("appsecret_proof")).toBe(
      metaAppSecretProof("EAAG_token", "app_secret_value"),
    );
  });
});
