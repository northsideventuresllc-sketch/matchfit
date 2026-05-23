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
import { POST } from "@/app/api/webhooks/stripe-connect/subscriptions/route";
import { StripeConnectConfigError } from "@/lib/stripe-connect/config";
import {
  handleConnectSubscriptionWebhookEvent,
  isConnectSubscriptionHandledWebhookType,
} from "@/lib/stripe-connect/subscription-webhooks";
import { getStripeConnectClient } from "@/lib/stripe-connect/client";
import { requireStripeConnectSubscriptionWebhookSecret } from "@/lib/stripe-connect/config";

vi.mock("@/lib/stripe-connect/config", () => ({
  requireStripeConnectSubscriptionWebhookSecret: vi.fn(),
  StripeConnectConfigError: class StripeConnectConfigError extends Error {},
}));

vi.mock("@/lib/stripe-connect/client", () => ({
  getStripeConnectClient: vi.fn(),
}));

vi.mock("@/lib/stripe-connect/subscription-webhooks", () => ({
  isConnectSubscriptionHandledWebhookType: vi.fn(),
  handleConnectSubscriptionWebhookEvent: vi.fn(),
}));

describe("stripe connect subscription webhook route", () => {
  const constructEvent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireStripeConnectSubscriptionWebhookSecret).mockReturnValue("whsec_test");
    vi.mocked(getStripeConnectClient).mockReturnValue({
      webhooks: { constructEvent },
    } as ReturnType<typeof getStripeConnectClient>);
    vi.mocked(isConnectSubscriptionHandledWebhookType).mockReturnValue(true);
    vi.mocked(handleConnectSubscriptionWebhookEvent).mockResolvedValue(undefined);
  });

  it("returns 503 when webhook secret config is unavailable", async () => {
    vi.mocked(requireStripeConnectSubscriptionWebhookSecret).mockImplementation(() => {
      throw new StripeConnectConfigError("Missing webhook secret.");
    });

    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe-connect/subscriptions", { method: "POST" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Missing webhook secret." });
  });

  it("returns 503 when stripe client cannot be created", async () => {
    vi.mocked(getStripeConnectClient).mockImplementation(() => {
      throw new StripeConnectConfigError("Missing API key.");
    });

    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe-connect/subscriptions", { method: "POST" }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Missing API key." });
  });

  it("returns 400 when Stripe-Signature is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe-connect/subscriptions", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing Stripe-Signature header." });
  });

  it("returns 400 when signature verification fails", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe-connect/subscriptions", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=sig" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid signature." });
  });

  it("dispatches handled webhook events to the subscription handler", async () => {
    constructEvent.mockReturnValue({
      type: "invoice.payment_succeeded",
    });

    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe-connect/subscriptions", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=sig" },
        body: "{\"id\":\"evt_1\"}",
      }),
    );

    expect(response.status).toBe(200);
    expect(isConnectSubscriptionHandledWebhookType).toHaveBeenCalledWith("invoice.payment_succeeded");
    expect(handleConnectSubscriptionWebhookEvent).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      received: true,
      type: "invoice.payment_succeeded",
    });
  });

  it("ignores unhandled webhook events and still acknowledges receipt", async () => {
    constructEvent.mockReturnValue({
      type: "payment_method.attached",
    });
    vi.mocked(isConnectSubscriptionHandledWebhookType).mockReturnValue(false);

    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe-connect/subscriptions", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=sig" },
        body: "{\"id\":\"evt_2\"}",
      }),
    );

    expect(response.status).toBe(200);
    expect(handleConnectSubscriptionWebhookEvent).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      received: true,
      type: "payment_method.attached",
    });
  });

  it("returns 500 when the event handler throws", async () => {
    constructEvent.mockReturnValue({
      type: "invoice.payment_failed",
    });
    vi.mocked(handleConnectSubscriptionWebhookEvent).mockRejectedValue(new Error("db down"));

    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe-connect/subscriptions", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=sig" },
        body: "{\"id\":\"evt_3\"}",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Handler error." });
  });
});
