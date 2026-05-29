import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFinalizeRegistrationAfterPayment,
  mockClientFindUnique,
  mockClearRegistrationHoldCookie,
  mockGetRegistrationHoldPendingId,
  mockSetClientSession,
  mockGetInvoicePaymentIntent,
  mockGetStripe,
  mockStripeSubscriptionRetrieve,
  mockCheckoutSessionRetrieve,
} = vi.hoisted(() => ({
  mockFinalizeRegistrationAfterPayment: vi.fn(),
  mockClientFindUnique: vi.fn(),
  mockClearRegistrationHoldCookie: vi.fn(),
  mockGetRegistrationHoldPendingId: vi.fn(),
  mockSetClientSession: vi.fn(),
  mockGetInvoicePaymentIntent: vi.fn(),
  mockGetStripe: vi.fn(),
  mockStripeSubscriptionRetrieve: vi.fn(),
  mockCheckoutSessionRetrieve: vi.fn(),
}));

vi.mock("@/lib/billing-finalize", () => ({
  finalizeRegistrationAfterPayment: mockFinalizeRegistrationAfterPayment,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: mockClientFindUnique,
    },
  },
}));

vi.mock("@/lib/session", () => ({
  clearRegistrationHoldCookie: mockClearRegistrationHoldCookie,
  getRegistrationHoldPendingId: mockGetRegistrationHoldPendingId,
  setClientSession: mockSetClientSession,
}));

vi.mock("@/lib/stripe-invoice-pi", () => ({
  getInvoicePaymentIntent: mockGetInvoicePaymentIntent,
}));

vi.mock("@/lib/stripe-server", () => ({
  getStripe: mockGetStripe,
}));

import { POST as postActivate } from "@/app/api/client/billing/activate/route";
import { POST as postConfirmCheckout } from "@/app/api/client/billing/confirm-checkout/route";

function postJson(body: unknown): Request {
  return new Request("https://example.test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("client billing completion routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetStripe.mockReturnValue({
      subscriptions: {
        retrieve: mockStripeSubscriptionRetrieve,
      },
      checkout: {
        sessions: {
          retrieve: mockCheckoutSessionRetrieve,
        },
      },
    });
    mockStripeSubscriptionRetrieve.mockResolvedValue({
      status: "active",
      latest_invoice: null,
    });
    mockCheckoutSessionRetrieve.mockResolvedValue({
      mode: "subscription",
      payment_status: "paid",
      metadata: { holdId: "hold_1" },
      subscription: "sub_1",
    });
    mockGetRegistrationHoldPendingId.mockResolvedValue("hold_1");
    mockFinalizeRegistrationAfterPayment.mockResolvedValue({
      ok: true,
      clientId: "client_1",
    });
    mockClientFindUnique.mockResolvedValue({ stayLoggedIn: false });
    mockClearRegistrationHoldCookie.mockResolvedValue(undefined);
    mockSetClientSession.mockResolvedValue(undefined);
    mockGetInvoicePaymentIntent.mockReturnValue(null);
  });

  it("POST /activate returns 400 for invalid request body", async () => {
    const res = await postActivate(postJson({}));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid request." });
  });

  it("POST /activate returns 402 when subscription is not active and invoice payment intent is not succeeded", async () => {
    mockStripeSubscriptionRetrieve.mockResolvedValueOnce({
      status: "incomplete",
      latest_invoice: { id: "in_1" },
    });
    mockGetInvoicePaymentIntent.mockReturnValueOnce({ status: "requires_payment_method" });

    const res = await postActivate(postJson({ subscriptionId: "sub_1" }));

    expect(res.status).toBe(402);
    await expect(res.json()).resolves.toEqual({
      error: "Your card has been declined. Please try another payment method or contact your bank.",
    });
    expect(mockFinalizeRegistrationAfterPayment).not.toHaveBeenCalled();
  });

  it("POST /activate finalizes registration and sets client session", async () => {
    const res = await postActivate(postJson({ subscriptionId: "sub_1" }));

    expect(mockFinalizeRegistrationAfterPayment).toHaveBeenCalledWith("sub_1");
    expect(mockClearRegistrationHoldCookie).toHaveBeenCalledTimes(1);
    expect(mockSetClientSession).toHaveBeenCalledWith("client_1", false);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, clientId: "client_1" });
  });

  it("POST /confirm-checkout returns 400 when checkout is not completed", async () => {
    mockCheckoutSessionRetrieve.mockResolvedValueOnce({
      mode: "subscription",
      payment_status: "unpaid",
      metadata: { holdId: "hold_1" },
      subscription: "sub_1",
    });

    const res = await postConfirmCheckout(postJson({ sessionId: "cs_1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Checkout not completed");
    expect(mockFinalizeRegistrationAfterPayment).not.toHaveBeenCalled();
  });

  it("POST /confirm-checkout returns 403 when cookie hold id does not match checkout metadata", async () => {
    mockGetRegistrationHoldPendingId.mockResolvedValueOnce("hold_2");

    const res = await postConfirmCheckout(postJson({ sessionId: "cs_1" }));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error:
        "This checkout does not match your current sign-up in this browser. Open the payment link from the same device you used to register, or sign in if you already have an account.",
    });
  });

  it("POST /confirm-checkout returns 400 when checkout session is missing hold metadata", async () => {
    mockCheckoutSessionRetrieve.mockResolvedValueOnce({
      mode: "subscription",
      payment_status: "paid",
      metadata: {},
      subscription: "sub_1",
    });

    const res = await postConfirmCheckout(postJson({ sessionId: "cs_1" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "This checkout session is missing registration metadata.",
    });
  });

  it("POST /confirm-checkout finalizes registration using session subscription object ids", async () => {
    mockCheckoutSessionRetrieve.mockResolvedValueOnce({
      mode: "subscription",
      payment_status: "paid",
      metadata: { holdId: "hold_1" },
      subscription: { id: "sub_from_obj" },
    });
    mockClientFindUnique.mockResolvedValueOnce(null);

    const res = await postConfirmCheckout(postJson({ sessionId: "cs_success" }));

    expect(mockFinalizeRegistrationAfterPayment).toHaveBeenCalledWith("sub_from_obj");
    expect(mockSetClientSession).toHaveBeenCalledWith("client_1", true);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, clientId: "client_1" });
  });
});
