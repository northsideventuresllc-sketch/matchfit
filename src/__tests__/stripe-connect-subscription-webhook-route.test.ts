import { beforeEach, describe, expect, it, vi } from "vitest";
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
