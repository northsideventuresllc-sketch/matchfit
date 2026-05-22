import { describe, expect, it } from "vitest";
import { isValidConnectAccountId } from "@/lib/stripe-connect/account-status";
import {
  CONNECT_SUBSCRIPTION_HANDLED_WEBHOOK_TYPES,
  isConnectSubscriptionHandledWebhookType,
} from "@/lib/stripe-connect/subscription-webhooks";

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
