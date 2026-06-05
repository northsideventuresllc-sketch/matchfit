import { afterEach, describe, expect, it } from "vitest";
import {
  isPlaceholderStripePublishableKey,
  isPlaceholderStripeSecretKey,
  isPlaceholderStripeWebhookSecret,
} from "@/lib/platform-secrets";

describe("platform-secrets placeholders", () => {
  const prevEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevEnv;
  });

  it("detects placeholder Stripe secret keys in production", () => {
    process.env.VERCEL_ENV = "production";
    expect(isPlaceholderStripeSecretKey("sk_test_..._key")).toBe(true);
    expect(isPlaceholderStripeSecretKey("sk_test_51abc")).toBe(true);
    expect(isPlaceholderStripeSecretKey("sk_live_51abc")).toBe(false);
  });

  it("detects placeholder publishable keys in production", () => {
    process.env.VERCEL_ENV = "production";
    expect(isPlaceholderStripePublishableKey("pk_test_abc")).toBe(true);
    expect(isPlaceholderStripePublishableKey("pk_live_abc")).toBe(false);
  });

  it("detects placeholder webhook secrets in production", () => {
    process.env.VERCEL_ENV = "production";
    expect(isPlaceholderStripeWebhookSecret("whsec_test")).toBe(true);
    expect(isPlaceholderStripeWebhookSecret("whsec_Sv3XUb7iHxOUIu1HfaFlBbSloXEdaaIn")).toBe(false);
  });
});
