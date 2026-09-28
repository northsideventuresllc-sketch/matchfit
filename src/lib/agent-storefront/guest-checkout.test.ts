import { afterEach, describe, expect, it, vi } from "vitest";

const sessionsCreate = vi.fn();
const sessionsRetrieve = vi.fn();

vi.mock("@/lib/stripe-server", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: sessionsCreate, retrieve: sessionsRetrieve } },
  }),
}));

const loadTrainerProfileAnswersAndOfferings = vi.fn();

afterEach(() => {
  vi.clearAllMocks();
});

vi.mock("@/lib/trainer-service-offerings", () => ({
  loadTrainerProfileAnswersAndOfferings: (...args: unknown[]) => loadTrainerProfileAnswersAndOfferings(...args),
  publishedPurchaseSkusFromLine: (line: { serviceId: string; priceUsd: number; label?: string }) => [
    {
      checkoutKey: line.serviceId,
      serviceId: line.serviceId,
      variationId: null,
      bundleTierId: null,
      bundleQuantity: 1,
      label: line.label ?? `${line.serviceId} — $${line.priceUsd}`,
      priceUsd: line.priceUsd,
      billingUnit: "single_session",
    },
  ],
}));

vi.mock("@/lib/trainer-service-offerings-document", () => ({
  parseTrainerServiceOfferingsJson: (raw: string | null | undefined) =>
    raw ? { schemaVersion: 1, services: JSON.parse(raw) } : { schemaVersion: 1, services: [] },
}));

import { createMatchFitAgentGuestCheckout, getAgentGuestCheckoutClaim } from "./guest-checkout";

const PUBLISHED_SERVICE = {
  serviceId: "personal_training",
  priceUsd: 50,
  label: "1:1 Coaching Session — $50",
};

describe("createMatchFitAgentGuestCheckout", () => {
  it("rejects missing input without calling Stripe or looking up a trainer", async () => {
    const result = await createMatchFitAgentGuestCheckout({
      tool: "mf_book_session",
      trainerId: "",
      checkoutKey: "",
    });
    expect(result.status).toBe("invalid_input");
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(loadTrainerProfileAnswersAndOfferings).not.toHaveBeenCalled();
  });

  it("looks up the trainer's own published price server-side — no amount field accepted", async () => {
    loadTrainerProfileAnswersAndOfferings.mockResolvedValueOnce({
      matchQuestionnaireAnswers: null,
      serviceOfferingsJson: JSON.stringify([PUBLISHED_SERVICE]),
    });
    sessionsCreate.mockResolvedValueOnce({ id: "cs_test_123", url: "https://checkout.stripe.com/cs_test_123" });

    const result = await createMatchFitAgentGuestCheckout({
      tool: "mf_book_session",
      trainerId: "trainer_1",
      checkoutKey: "personal_training",
      buyerEmail: "buyer@example.com",
    });

    expect(result).toMatchObject({ status: "awaiting_payment", orderId: "cs_test_123", amountUsd: 50 });
    const call = sessionsCreate.mock.calls[0][0];
    expect(call.mode).toBe("payment");
    expect(call.customer_email).toBe("buyer@example.com");
    expect(call.metadata.source).toBe("agent_storefront");
    // The type itself has no amount field, so there is nothing for a caller to tamper with —
    // this asserts the actual Stripe line item always reflects the server-looked-up price.
    expect(call.line_items[0].price_data.unit_amount).toBe(5000);
  });

  it("rejects a checkoutKey the trainer has not published, regardless of what a caller might have tried to charge", async () => {
    loadTrainerProfileAnswersAndOfferings.mockResolvedValueOnce({
      matchQuestionnaireAnswers: null,
      serviceOfferingsJson: JSON.stringify([PUBLISHED_SERVICE]),
    });

    const result = await createMatchFitAgentGuestCheckout({
      tool: "mf_book_session",
      trainerId: "trainer_1",
      checkoutKey: "not_a_real_service",
      buyerEmail: "buyer@example.com",
    });

    expect(result.status).toBe("invalid_input");
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects an unknown trainer without ever reaching Stripe", async () => {
    loadTrainerProfileAnswersAndOfferings.mockResolvedValueOnce(null);
    const result = await createMatchFitAgentGuestCheckout({
      tool: "mf_book_session",
      trainerId: "does_not_exist",
      checkoutKey: "personal_training",
    });
    expect(result.status).toBe("invalid_input");
    expect(sessionsCreate).not.toHaveBeenCalled();
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
