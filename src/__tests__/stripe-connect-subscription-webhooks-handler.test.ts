import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateConnectDemoSellerSubscription } from "@/lib/stripe-connect/sellers-db";
import { handleConnectSubscriptionWebhookEvent } from "@/lib/stripe-connect/subscription-webhooks";

vi.mock("@/lib/stripe-connect/sellers-db", () => ({
  updateConnectDemoSellerSubscription: vi.fn(),
}));

function makeEvent(type: string, object: unknown): Stripe.Event {
  return {
    id: "evt_test",
    object: "event",
    api_version: null,
    created: Math.floor(Date.now() / 1000),
    data: { object } as Stripe.Event.Data,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type: type as Stripe.Event.Type,
  };
}

describe("handleConnectSubscriptionWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores active subscription state for created/updated events", async () => {
    const event = makeEvent("customer.subscription.updated", {
      id: "sub_123",
      status: "active",
      customer_account: "acct_123",
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscription).toHaveBeenCalledWith({
      stripeAccountId: "acct_123",
      subscriptionId: "sub_123",
      status: "active",
    });
  });

  it("stores canceled status for deleted subscription events", async () => {
    const event = makeEvent("customer.subscription.deleted", {
      id: "sub_123",
      status: "active",
      customer_account: "acct_123",
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscription).toHaveBeenCalledWith({
      stripeAccountId: "acct_123",
      subscriptionId: "sub_123",
      status: "canceled",
    });
  });

  it("does not persist subscription events when customer_account is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const event = makeEvent("customer.subscription.created", {
      id: "sub_123",
      status: "active",
      customer_account: null,
    });

    try {
      await handleConnectSubscriptionWebhookEvent(event);

      expect(updateConnectDemoSellerSubscription).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("stores invoice success as active", async () => {
    const event = makeEvent("invoice.payment_succeeded", {
      id: "in_123",
      customer_account: "acct_123",
      parent: { subscription_details: { subscription: "sub_123" } },
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscription).toHaveBeenCalledWith({
      stripeAccountId: "acct_123",
      subscriptionId: "sub_123",
      status: "active",
    });
  });

  it("stores invoice failure as past_due", async () => {
    const event = makeEvent("invoice.payment_failed", {
      id: "in_123",
      customer_account: "acct_123",
      parent: { subscription_details: { subscription: "sub_123" } },
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscription).toHaveBeenCalledWith({
      stripeAccountId: "acct_123",
      subscriptionId: "sub_123",
      status: "past_due",
    });
  });

  it("stores null subscription id when invoice subscription field is not a string", async () => {
    const event = makeEvent("invoice.payment_succeeded", {
      id: "in_123",
      customer_account: "acct_123",
      parent: { subscription_details: { subscription: 42 } },
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscription).toHaveBeenCalledWith({
      stripeAccountId: "acct_123",
      subscriptionId: null,
      status: "active",
    });
  });

  it("ignores invoice events without a connected account id", async () => {
    const event = makeEvent("invoice.payment_failed", {
      id: "in_123",
      customer_account: "cus_123",
      parent: { subscription_details: { subscription: "sub_123" } },
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscription).not.toHaveBeenCalled();
  });

  it("ignores event types outside the subscription handler switch", async () => {
    const event = makeEvent("customer.updated", {
      id: "cus_123",
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscription).not.toHaveBeenCalled();
  });
});
