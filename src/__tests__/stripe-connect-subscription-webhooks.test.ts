import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const { updateConnectDemoSellerSubscriptionMock } = vi.hoisted(() => ({
  updateConnectDemoSellerSubscriptionMock: vi.fn(),
}));

vi.mock("@/lib/stripe-connect/sellers-db", () => ({
  updateConnectDemoSellerSubscription: updateConnectDemoSellerSubscriptionMock,
}));

import { handleConnectSubscriptionWebhookEvent } from "@/lib/stripe-connect/subscription-webhooks";

function makeEvent(type: Stripe.Event.Type, dataObject: Record<string, unknown>): Stripe.Event {
  return {
    id: "evt_test",
    object: "event",
    api_version: "2025-09-30.clover",
    created: 0,
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: "req_test",
      idempotency_key: null,
    },
    type,
    data: {
      object: dataObject as Stripe.Event.Data.Object,
    },
  } as Stripe.Event;
}

describe("handleConnectSubscriptionWebhookEvent", () => {
  beforeEach(() => {
    updateConnectDemoSellerSubscriptionMock.mockReset();
    vi.restoreAllMocks();
  });

  it("updates subscription snapshots for customer.subscription.updated", async () => {
    const event = makeEvent("customer.subscription.updated", {
      id: "sub_123",
      status: "active",
      customer_account: "acct_123",
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscriptionMock).toHaveBeenCalledTimes(1);
    expect(updateConnectDemoSellerSubscriptionMock).toHaveBeenCalledWith({
      stripeAccountId: "acct_123",
      subscriptionId: "sub_123",
      status: "active",
    });
  });

  it("forces canceled status for customer.subscription.deleted events", async () => {
    const event = makeEvent("customer.subscription.deleted", {
      id: "sub_123",
      status: "active",
      customer_account: "acct_123",
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscriptionMock).toHaveBeenCalledWith({
      stripeAccountId: "acct_123",
      subscriptionId: "sub_123",
      status: "canceled",
    });
  });

  it("does not fall back to legacy customer ids when customer_account is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const event = makeEvent("customer.subscription.created", {
      id: "sub_legacy",
      status: "active",
      customer: "cus_legacy",
      customer_account: null,
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscriptionMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("marks invoice.payment_succeeded events as active", async () => {
    const event = makeEvent("invoice.payment_succeeded", {
      id: "in_123",
      customer_account: "acct_123",
      parent: {
        subscription_details: {
          subscription: "sub_123",
        },
      },
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscriptionMock).toHaveBeenCalledWith({
      stripeAccountId: "acct_123",
      subscriptionId: "sub_123",
      status: "active",
    });
  });

  it("marks invoice.payment_failed events as past_due and allows unknown subscription ids", async () => {
    const event = makeEvent("invoice.payment_failed", {
      id: "in_123",
      customer_account: "acct_123",
      parent: {
        subscription_details: {
          subscription: 42,
        },
      },
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscriptionMock).toHaveBeenCalledWith({
      stripeAccountId: "acct_123",
      subscriptionId: null,
      status: "past_due",
    });
  });

  it("ignores invoice events that do not provide an acct_ customer_account", async () => {
    const event = makeEvent("invoice.payment_succeeded", {
      id: "in_123",
      customer_account: "cus_wrong",
      parent: {
        subscription_details: {
          subscription: "sub_123",
        },
      },
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscriptionMock).not.toHaveBeenCalled();
  });

  it("ignores unhandled event types", async () => {
    const event = makeEvent("checkout.session.completed", {
      id: "cs_123",
    });

    await handleConnectSubscriptionWebhookEvent(event);

    expect(updateConnectDemoSellerSubscriptionMock).not.toHaveBeenCalled();
  });
});
