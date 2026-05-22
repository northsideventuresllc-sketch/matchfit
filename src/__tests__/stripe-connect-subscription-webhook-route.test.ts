import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireWebhookSecretMock,
  getStripeConnectClientMock,
  isHandledWebhookTypeMock,
  handleWebhookEventMock,
  constructEventMock,
} = vi.hoisted(() => ({
  requireWebhookSecretMock: vi.fn(),
  getStripeConnectClientMock: vi.fn(),
  isHandledWebhookTypeMock: vi.fn(),
  handleWebhookEventMock: vi.fn(),
  constructEventMock: vi.fn(),
}));

vi.mock("@/lib/stripe-connect/config", () => {
  class StripeConnectConfigError extends Error {}

  return {
    requireStripeConnectSubscriptionWebhookSecret: requireWebhookSecretMock,
    StripeConnectConfigError,
  };
});

vi.mock("@/lib/stripe-connect/client", () => ({
  getStripeConnectClient: getStripeConnectClientMock,
}));

vi.mock("@/lib/stripe-connect/subscription-webhooks", () => ({
  isConnectSubscriptionHandledWebhookType: isHandledWebhookTypeMock,
  handleConnectSubscriptionWebhookEvent: handleWebhookEventMock,
}));

import { POST } from "@/app/api/webhooks/stripe-connect/subscriptions/route";
import { StripeConnectConfigError } from "@/lib/stripe-connect/config";

function makeRequest(signature?: string): Request {
  const headers = signature ? { "stripe-signature": signature } : {};
  return new Request("http://localhost/api/webhooks/stripe-connect/subscriptions", {
    method: "POST",
    headers,
    body: JSON.stringify({ ok: true }),
  });
}

describe("POST /api/webhooks/stripe-connect/subscriptions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requireWebhookSecretMock.mockReset();
    getStripeConnectClientMock.mockReset();
    isHandledWebhookTypeMock.mockReset();
    handleWebhookEventMock.mockReset();
    constructEventMock.mockReset();

    requireWebhookSecretMock.mockReturnValue("whsec_test");
    getStripeConnectClientMock.mockReturnValue({
      webhooks: {
        constructEvent: constructEventMock,
      },
    });
    constructEventMock.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: {} },
    });
    isHandledWebhookTypeMock.mockReturnValue(true);
    handleWebhookEventMock.mockResolvedValue(undefined);
  });

  it("returns 503 when the webhook secret is not configured", async () => {
    requireWebhookSecretMock.mockImplementation(() => {
      throw new StripeConnectConfigError("Missing STRIPE_CONNECT_SUBSCRIPTION_WEBHOOK_SECRET.");
    });

    const response = await POST(makeRequest("sig_test"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toContain("Missing STRIPE_CONNECT_SUBSCRIPTION_WEBHOOK_SECRET");
    expect(getStripeConnectClientMock).not.toHaveBeenCalled();
  });

  it("returns 503 when Stripe client config is unavailable", async () => {
    getStripeConnectClientMock.mockImplementation(() => {
      throw new StripeConnectConfigError("Missing STRIPE_SECRET_KEY.");
    });

    const response = await POST(makeRequest("sig_test"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toContain("Missing STRIPE_SECRET_KEY");
  });

  it("returns 400 when Stripe-Signature header is missing", async () => {
    const response = await POST(makeRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Missing Stripe-Signature header.");
    expect(constructEventMock).not.toHaveBeenCalled();
  });

  it("returns 400 when signature verification fails", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const response = await POST(makeRequest("sig_test"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid signature.");
  });

  it("dispatches handled event types to the webhook handler", async () => {
    const event = { type: "customer.subscription.updated", data: { object: {} } };
    constructEventMock.mockReturnValue(event);
    isHandledWebhookTypeMock.mockReturnValue(true);

    const response = await POST(makeRequest("sig_test"));
    const body = (await response.json()) as { received: boolean; type: string };

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, type: "customer.subscription.updated" });
    expect(handleWebhookEventMock).toHaveBeenCalledWith(event);
  });

  it("acknowledges unhandled event types without calling the handler", async () => {
    const event = { type: "invoice.created", data: { object: {} } };
    constructEventMock.mockReturnValue(event);
    isHandledWebhookTypeMock.mockReturnValue(false);

    const response = await POST(makeRequest("sig_test"));
    const body = (await response.json()) as { received: boolean; type: string };

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, type: "invoice.created" });
    expect(handleWebhookEventMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the webhook handler throws", async () => {
    handleWebhookEventMock.mockRejectedValue(new Error("db offline"));

    const response = await POST(makeRequest("sig_test"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe("Handler error.");
  });
});
