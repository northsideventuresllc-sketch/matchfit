import { describe, expect, it } from "vitest";
import {
  CLIENT_PLATFORM_SUBSCRIPTION_PROFIT_CENTS,
  oneTimePurchaseRevenueProfit,
  serviceCheckoutRevenueProfit,
  subscriptionRevenueProfit,
} from "@/lib/platform-revenue-accounting";
import { computeCheckoutFeeBreakdown } from "@/lib/stripe-checkout-line-items";

describe("platform-revenue-accounting", () => {
  it("subscription revenue adds processing fee on platform portion", () => {
    const { revenueCents, grossProfitCents } = subscriptionRevenueProfit(
      CLIENT_PLATFORM_SUBSCRIPTION_PROFIT_CENTS,
    );
    expect(grossProfitCents).toBe(1000);
    expect(revenueCents).toBeGreaterThan(1000);
  });

  it("service checkout profit is admin fee", () => {
    const { revenueCents, grossProfitCents } = serviceCheckoutRevenueProfit({
      amountCents: 5000,
      totalChargedCents: 6000,
      adminFeeCents: 1000,
    });
    expect(revenueCents).toBe(6000);
    expect(grossProfitCents).toBe(1000);
  });

  it("one-time purchase profit excludes only processor fee", () => {
    const breakdown = computeCheckoutFeeBreakdown({
      baseCents: 2000,
      includeAdminFee: true,
      includeProcessingFee: true,
    });
    const { revenueCents, grossProfitCents } = oneTimePurchaseRevenueProfit(breakdown);
    expect(revenueCents).toBe(breakdown.totalChargedCents);
    expect(grossProfitCents).toBe(breakdown.totalChargedCents - breakdown.processingCents);
  });
});
