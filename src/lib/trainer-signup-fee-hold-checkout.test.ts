import { describe, expect, it } from "vitest";
import { paymentIntentIdFromCheckoutSession } from "@/lib/trainer-signup-fee-hold-checkout";

describe("trainer-signup-fee-hold-checkout", () => {
  it("reads payment intent id from string or expanded object", () => {
    expect(paymentIntentIdFromCheckoutSession("pi_123")).toBe("pi_123");
    expect(paymentIntentIdFromCheckoutSession({ id: "pi_456" })).toBe("pi_456");
    expect(paymentIntentIdFromCheckoutSession(null)).toBeNull();
  });
});
