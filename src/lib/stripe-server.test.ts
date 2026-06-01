import { afterEach, describe, expect, it } from "vitest";
import { isStripeLiveSecretKey, stripeObjectIsLiveBilling } from "@/lib/stripe-server";

describe("stripe-server billing mode helpers", () => {
  const prev = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    if (prev === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prev;
  });

  it("detects live secret keys", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc";
    expect(isStripeLiveSecretKey()).toBe(true);
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    expect(isStripeLiveSecretKey()).toBe(false);
  });

  it("treats only livemode true as live billing", () => {
    expect(stripeObjectIsLiveBilling(true)).toBe(true);
    expect(stripeObjectIsLiveBilling(false)).toBe(false);
    expect(stripeObjectIsLiveBilling(undefined)).toBe(false);
  });
});
