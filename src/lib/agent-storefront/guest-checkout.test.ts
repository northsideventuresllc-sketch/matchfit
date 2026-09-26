import { describe, expect, it, vi } from "vitest";

const sessionsCreate = vi.fn();
const sessionsRetrieve = vi.fn();

vi.mock("@/lib/stripe-server", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: sessionsCreate, retrieve: sessionsRetrieve } },
  }),
}));

import { createMatchFitAgentGuestCheckout, getAgentGuestCheckoutClaim } from "./guest-checkout";

describe("createMatchFitAgentGuestCheckout", () => {
  it("rejects missing input without calling Stripe", async () => {
    const result = await createMatchFitAgentGuestCheckout({
      tool: "mf_book_session",
      trainerId: "",
      serviceName: "",
      amountCents: 0,
    });
    expect(result.status).toBe("invalid_input");
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("creates a guest session keyed by session id, no account required", async () => {
    sessionsCreate.mockResolvedValueOnce({ id: "cs_test_123", url: "https://checkout.stripe.com/cs_test_123" });
    const result = await createMatchFitAgentGuestCheckout({
      tool: "mf_book_session",
      trainerId: "trainer_1",
      serviceName: "1:1 Coaching Session",
      amountCents: 5000,
      buyerEmail: "buyer@example.com",
    });
    expect(result).toMatchObject({
      status: "awaiting_payment",
      orderId: "cs_test_123",
      amountUsd: 50,
    });
    const call = sessionsCreate.mock.calls[0][0];
    expect(call.mode).toBe("payment");
    expect(call.customer_email).toBe("buyer@example.com");
    expect(call.metadata.source).toBe("agent_storefront");
  });
});

describe("getAgentGuestCheckoutClaim", () => {
  it("returns paid state and buyer email for claim-on-signup matching", async () => {
    sessionsRetrieve.mockResolvedValueOnce({
      payment_status: "paid",
      customer_details: { email: "buyer@example.com" },
    });
    const claim = await getAgentGuestCheckoutClaim("cs_test_123");
    expect(claim).toEqual({ paid: true, buyerEmail: "buyer@example.com" });
  });

  it("returns null for an empty order id", async () => {
    expect(await getAgentGuestCheckoutClaim("")).toBeNull();
  });
});
