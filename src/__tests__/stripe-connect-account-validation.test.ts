import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectAccountRequestOptions,
  fetchConnectAccountStatus,
  isValidConnectAccountId,
} from "@/lib/stripe-connect/account-status";
import {
  CONNECT_SUBSCRIPTION_HANDLED_WEBHOOK_TYPES,
  handleConnectSubscriptionWebhookEvent,
  isConnectSubscriptionHandledWebhookType,
} from "@/lib/stripe-connect/subscription-webhooks";

const { mockRetrieveAccount, mockUpdateConnectDemoSellerSubscription } = vi.hoisted(() => ({
  mockRetrieveAccount: vi.fn(),
  mockUpdateConnectDemoSellerSubscription: vi.fn(),
}));

vi.mock("@/lib/stripe-connect/client", () => ({
  getStripeConnectClient: () => ({
    v2: {
      core: {
        accounts: {
          retrieve: mockRetrieveAccount,
        },
      },
    },
  }),
}));

vi.mock("@/lib/stripe-connect/sellers-db", () => ({
  updateConnectDemoSellerSubscription: mockUpdateConnectDemoSellerSubscription,
}));

beforeEach(() => {
  mockRetrieveAccount.mockReset();
  mockUpdateConnectDemoSellerSubscription.mockReset();
});

describe("isValidConnectAccountId", () => {
  it("accepts Stripe Connect account ids", () => {
    expect(isValidConnectAccountId("acct_123")).toBe(true);
  });

  it("rejects missing or invalid prefixes", () => {
    expect(isValidConnectAccountId("")).toBe(false);
    expect(isValidConnectAccountId("cus_123")).toBe(false);
    expect(isValidConnectAccountId(undefined)).toBe(false);
  });
});

describe("fetchConnectAccountStatus", () => {
  it("maps Stripe account capability and requirement fields", async () => {
    mockRetrieveAccount.mockResolvedValue({
      id: "acct_123",
      display_name: "Demo Seller",
      contact_email: "seller@example.com",
      configuration: {
        merchant: {
          capabilities: {
            card_payments: {
              status: "active",
            },
          },
        },
      },
      requirements: {
        summary: {
          minimum_deadline: {
            status: "not_due",
          },
        },
      },
    });

    await expect(fetchConnectAccountStatus("acct_123")).resolves.toEqual({
      accountId: "acct_123",
      displayName: "Demo Seller",
      contactEmail: "seller@example.com",
      readyToProcessPayments: true,
      cardPaymentsStatus: "active",
      requirementsStatus: "not_due",
      onboardingComplete: true,
    });

    expect(mockRetrieveAccount).toHaveBeenCalledWith("acct_123", {
      include: ["configuration.merchant", "requirements"],
    });
  });

  it("marks onboarding incomplete when requirements are due", async () => {
    mockRetrieveAccount.mockResolvedValue({
      id: "acct_456",
      display_name: null,
      contact_email: null,
      configuration: {
        merchant: {
          capabilities: {
            card_payments: {
              status: "pending",
            },
          },
        },
      },
      requirements: {
        summary: {
          minimum_deadline: {
            status: "currently_due",
          },
        },
      },
    });

    const status = await fetchConnectAccountStatus("acct_456");
    expect(status.readyToProcessPayments).toBe(false);
    expect(status.onboardingComplete).toBe(false);
    expect(status.displayName).toBeNull();
    expect(status.contactEmail).toBeNull();
  });
});

describe("connectAccountRequestOptions", () => {
  it("returns Stripe-Account request options", () => {
    expect(connectAccountRequestOptions("acct_987")).toEqual({
      stripeAccount: "acct_987",
    });
  });
});

describe("Connect subscription webhook types", () => {
  it("only includes types handled by the subscription webhook switch", () => {
    const handledInSwitch = new Set([
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_succeeded",
      "invoice.payment_failed",
    ]);

    for (const type of CONNECT_SUBSCRIPTION_HANDLED_WEBHOOK_TYPES) {
      expect(handledInSwitch.has(type)).toBe(true);
      expect(isConnectSubscriptionHandledWebhookType(type)).toBe(true);
    }

    expect(isConnectSubscriptionHandledWebhookType("payment_method.attached")).toBe(false);
    expect(isConnectSubscriptionHandledWebhookType("customer.updated")).toBe(false);
  });
});

describe("handleConnectSubscriptionWebhookEvent", () => {
  it("updates seller subscription status for customer.subscription events", async () => {
    await handleConnectSubscriptionWebhookEvent({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          status: "active",
          customer_account: "acct_demo_1",
        },
      },
    } as never);

    expect(mockUpdateConnectDemoSellerSubscription).toHaveBeenCalledWith({
      stripeAccountId: "acct_demo_1",
      subscriptionId: "sub_123",
      status: "active",
    });
  });

  it("marks deleted subscriptions as canceled", async () => {
    await handleConnectSubscriptionWebhookEvent({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_999",
          status: "canceled",
          customer_account: "acct_demo_2",
        },
      },
    } as never);

    expect(mockUpdateConnectDemoSellerSubscription).toHaveBeenCalledWith({
      stripeAccountId: "acct_demo_2",
      subscriptionId: "sub_999",
      status: "canceled",
    });
  });

  it("ignores subscription events without a V2 customer_account", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await handleConnectSubscriptionWebhookEvent({
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_legacy",
          status: "active",
          customer: "acct_legacy_should_not_be_used",
        },
      },
    } as never);

    expect(mockUpdateConnectDemoSellerSubscription).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("handles invoice.payment_succeeded events", async () => {
    await handleConnectSubscriptionWebhookEvent({
      type: "invoice.payment_succeeded",
      data: {
        object: {
          customer_account: "acct_demo_3",
          parent: {
            subscription_details: {
              subscription: "sub_from_invoice",
            },
          },
        },
      },
    } as never);

    expect(mockUpdateConnectDemoSellerSubscription).toHaveBeenCalledWith({
      stripeAccountId: "acct_demo_3",
      subscriptionId: "sub_from_invoice",
      status: "active",
    });
  });

  it("handles invoice.payment_failed events even when subscription id is missing", async () => {
    await handleConnectSubscriptionWebhookEvent({
      type: "invoice.payment_failed",
      data: {
        object: {
          customer_account: "acct_demo_4",
          parent: {
            subscription_details: {
              subscription: { id: "not-a-string" },
            },
          },
        },
      },
    } as never);

    expect(mockUpdateConnectDemoSellerSubscription).toHaveBeenCalledWith({
      stripeAccountId: "acct_demo_4",
      subscriptionId: null,
      status: "past_due",
    });
  });

  it("ignores unhandled event types", async () => {
    await handleConnectSubscriptionWebhookEvent({
      type: "customer.created",
      data: {
        object: {},
      },
    } as never);

    expect(mockUpdateConnectDemoSellerSubscription).not.toHaveBeenCalled();
  });
});
