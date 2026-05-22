import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { handleConnectSubscriptionWebhookEvent } from "@/lib/stripe-connect/subscription-webhooks";

const updateConnectDemoSellerSubscriptionMock = vi.fn();

vi.mock("@/lib/stripe-connect/sellers-db", () => ({
  updateConnectDemoSellerSubscription: updateConnectDemoSellerSubscriptionMock,
}));

function asStripeEvent(event: unknown): Stripe.Event {
  return event as Stripe.Event;
}

describe("handleConnectSubscriptionWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists subscription updates using customer_account", async () => {
    await handleConnectSubscriptionWebhookEvent(
      asStripeEvent({
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_123",
            status: "trialing",
            customer_account: "acct_demo123",
          },
        },
      }),
    );

    expect(updateConnectDemoSellerSubscriptionMock).toHaveBeenCalledWith({
      stripeAccountId: "acct_demo123",
      subscriptionId: "sub_123",
      status: "trialing",
    });
  });

  it("falls back to legacy customer id for subscription events", async () => {
    await handleConnectSubscriptionWebhookEvent(
      asStripeEvent({
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_legacy",
            status: "active",
            customer: "acct_legacy456",
          },
        },
      }),
    );

    expect(updateConnectDemoSellerSubscriptionMock).toHaveBeenCalledWith({
      stripeAccountId: "acct_legacy456",
      subscriptionId: "sub_legacy",
      status: "active",
    });
  });

  it("marks deleted subscriptions as canceled", async () => {
    await handleConnectSubscriptionWebhookEvent(
      asStripeEvent({
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_deleted",
            status: "active",
            customer_account: "acct_demo123",
          },
        },
      }),
    );

    expect(updateConnectDemoSellerSubscriptionMock).toHaveBeenCalledWith({
      stripeAccountId: "acct_demo123",
      subscriptionId: "sub_deleted",
      status: "canceled",
    });
  });

  it("ignores subscription events without an acct_ account id and logs a warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await handleConnectSubscriptionWebhookEvent(
      asStripeEvent({
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_unknown",
            status: "active",
            customer_account: "cus_non_connect",
          },
        },
      }),
    );

    expect(updateConnectDemoSellerSubscriptionMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("updates active status on invoice.payment_succeeded using nested parent subscription id", async () => {
    await handleConnectSubscriptionWebhookEvent(
      asStripeEvent({
        type: "invoice.payment_succeeded",
        data: {
          object: {
            customer_account: "acct_invoice123",
            parent: {
              subscription_details: {
                subscription: "sub_from_parent",
              },
            },
          },
        },
      }),
    );

    expect(updateConnectDemoSellerSubscriptionMock).toHaveBeenCalledWith({
      stripeAccountId: "acct_invoice123",
      subscriptionId: "sub_from_parent",
      status: "active",
    });
  });

  it("updates past_due status on invoice.payment_failed", async () => {
    await handleConnectSubscriptionWebhookEvent(
      asStripeEvent({
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: "acct_invoice789",
            parent: {
              subscription_details: {
                subscription: "sub_failed_parent",
              },
            },
          },
        },
      }),
    );

    expect(updateConnectDemoSellerSubscriptionMock).toHaveBeenCalledWith({
      stripeAccountId: "acct_invoice789",
      subscriptionId: "sub_failed_parent",
      status: "past_due",
    });
  });
});
