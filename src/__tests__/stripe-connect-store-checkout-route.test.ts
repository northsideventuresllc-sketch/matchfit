import { beforeEach, describe, expect, it, vi } from "vitest";

const productsRetrieveMock = vi.fn();
const checkoutSessionCreateMock = vi.fn();
const getStripeConnectClientMock = vi.fn(() => ({
  products: { retrieve: productsRetrieveMock },
  checkout: {
    sessions: {
      create: checkoutSessionCreateMock,
    },
  },
}));

const getAppOriginFromRequestMock = vi.fn(() => "https://matchfit.test");
const isValidConnectAccountIdMock = vi.fn(() => true);
const connectAccountRequestOptionsMock = vi.fn((accountId: string) => ({ stripeAccount: accountId }));
const computeApplicationFeeCentsMock = vi.fn((amountCents: number) => Math.floor(amountCents * 0.2));
const stripeConnectApplicationFeeBpsMock = vi.fn(() => 2000);
const stripeConnectApiErrorMock = vi.fn((_error: unknown, message: string) =>
  Response.json({ error: message }, { status: 502 }),
);

vi.mock("@/lib/stripe-connect/client", () => ({
  getStripeConnectClient: getStripeConnectClientMock,
}));

vi.mock("@/lib/app-origin", () => ({
  getAppOriginFromRequest: getAppOriginFromRequestMock,
}));

vi.mock("@/lib/stripe-connect/account-status", () => ({
  isValidConnectAccountId: isValidConnectAccountIdMock,
  connectAccountRequestOptions: connectAccountRequestOptionsMock,
}));

vi.mock("@/lib/stripe-connect/config", () => ({
  computeApplicationFeeCents: computeApplicationFeeCentsMock,
  stripeConnectApplicationFeeBps: stripeConnectApplicationFeeBpsMock,
}));

vi.mock("@/lib/stripe-connect/api-error", () => ({
  stripeConnectApiError: stripeConnectApiErrorMock,
}));

import { POST } from "@/app/api/stripe-connect-demo/store/[accountId]/checkout/route";

type RouteContext = { params: Promise<{ accountId: string }> };

function routeContext(accountId = "acct_test_123"): RouteContext {
  return { params: Promise.resolve({ accountId }) };
}

describe("POST /api/stripe-connect-demo/store/[accountId]/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isValidConnectAccountIdMock.mockReturnValue(true);
    connectAccountRequestOptionsMock.mockImplementation((accountId: string) => ({ stripeAccount: accountId }));
    getAppOriginFromRequestMock.mockReturnValue("https://matchfit.test");
    computeApplicationFeeCentsMock.mockImplementation((amountCents: number) => Math.floor(amountCents * 0.2));
    stripeConnectApplicationFeeBpsMock.mockReturnValue(2000);
    stripeConnectApiErrorMock.mockImplementation((_error: unknown, message: string) =>
      Response.json({ error: message }, { status: 502 }),
    );
  });

  it("returns 400 when account id is invalid", async () => {
    isValidConnectAccountIdMock.mockReturnValue(false);

    const response = await POST(
      new Request("http://localhost/api/test", {
        method: "POST",
        body: JSON.stringify({ productId: "prod_123" }),
      }),
      routeContext("not_connect"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid connected account id." });
    expect(productsRetrieveMock).not.toHaveBeenCalled();
    expect(checkoutSessionCreateMock).not.toHaveBeenCalled();
  });

  it("returns 400 when productId is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/test", {
        method: "POST",
        body: JSON.stringify({ quantity: 4 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "productId is required." });
    expect(productsRetrieveMock).not.toHaveBeenCalled();
  });

  it("returns 400 when product default price is not available", async () => {
    productsRetrieveMock.mockResolvedValue({ id: "prod_123", default_price: null });

    const response = await POST(
      new Request("http://localhost/api/test", {
        method: "POST",
        body: JSON.stringify({ productId: "prod_123", quantity: 2 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Product has no default price." });
    expect(checkoutSessionCreateMock).not.toHaveBeenCalled();
  });

  it("creates checkout session with clamped quantity and returns session URL", async () => {
    productsRetrieveMock.mockResolvedValue({
      id: "prod_123",
      default_price: { id: "price_123", unit_amount: 2500 },
    });
    checkoutSessionCreateMock.mockResolvedValue({
      id: "cs_test",
      url: "https://checkout.stripe.com/c/pay/cs_test",
    });
    computeApplicationFeeCentsMock.mockReturnValue(4950);

    const response = await POST(
      new Request("http://localhost/api/test", {
        method: "POST",
        body: JSON.stringify({ productId: " prod_123 ", quantity: 150.8 }),
      }),
      routeContext("acct_live_456"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_test",
    });
    expect(productsRetrieveMock).toHaveBeenCalledWith(
      "prod_123",
      { expand: ["default_price"] },
      { stripeAccount: "acct_live_456" },
    );
    expect(computeApplicationFeeCentsMock).toHaveBeenCalledWith(2500 * 99);
    expect(checkoutSessionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: [{ price: "price_123", quantity: 99 }],
        payment_intent_data: { application_fee_amount: 4950 },
        success_url:
          "https://matchfit.test/stripe-connect-demo/success?session_id={CHECKOUT_SESSION_ID}&accountId=acct_live_456",
        cancel_url: "https://matchfit.test/stripe-connect-demo/store/acct_live_456",
        metadata: {
          connect_demo: "storefront",
          connected_account_id: "acct_live_456",
          application_fee_bps: "2000",
        },
      }),
      { stripeAccount: "acct_live_456" },
    );
  });

  it("returns 500 when stripe checkout response has no URL", async () => {
    productsRetrieveMock.mockResolvedValue({
      id: "prod_123",
      default_price: { id: "price_123", unit_amount: 1200 },
    });
    checkoutSessionCreateMock.mockResolvedValue({ id: "cs_missing_url" });

    const response = await POST(
      new Request("http://localhost/api/test", {
        method: "POST",
        body: JSON.stringify({ productId: "prod_123", quantity: 1 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Checkout session missing URL." });
  });

  it("delegates unexpected failures to stripeConnectApiError", async () => {
    const warnSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    productsRetrieveMock.mockRejectedValue(new Error("stripe exploded"));
    stripeConnectApiErrorMock.mockReturnValueOnce(
      Response.json({ error: "Could not start checkout." }, { status: 502 }),
    );

    try {
      const response = await POST(
        new Request("http://localhost/api/test", {
          method: "POST",
          body: JSON.stringify({ productId: "prod_123", quantity: 1 }),
        }),
        routeContext(),
      );

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({ error: "Could not start checkout." });
      expect(stripeConnectApiErrorMock).toHaveBeenCalledTimes(1);
      expect(stripeConnectApiErrorMock).toHaveBeenCalledWith(expect.any(Error), "Could not start checkout.");
    } finally {
      warnSpy.mockRestore();
    }
  });
});
