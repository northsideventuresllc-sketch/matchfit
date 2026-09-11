import { adminFeeCentsFromBaseSubtotalCents } from "@/lib/platform-fees";
import type { CheckoutFeeBreakdown } from "@/lib/stripe-checkout-line-items";
import { estimateStripeProcessingFeeCents } from "@/lib/stripe-processing-fee";
import { TOS_CLIENT_PLATFORM_SUBSCRIPTION_USD } from "@/lib/tos-implementation-contract";

/** Trainer Independent Pro / Premium Page subscription (Terms §3). */
export const TRAINER_PREMIUM_SUBSCRIPTION_USD = 15;

export const CLIENT_PLATFORM_SUBSCRIPTION_PROFIT_CENTS = TOS_CLIENT_PLATFORM_SUBSCRIPTION_USD * 100;
export const TRAINER_PREMIUM_SUBSCRIPTION_PROFIT_CENTS = TRAINER_PREMIUM_SUBSCRIPTION_USD * 100;

export type PlatformRevenueCategory =
  | "SERVICE_CHECKOUT"
  | "CLIENT_PLATFORM_SUBSCRIPTION"
  | "TRAINER_PREMIUM_SUBSCRIPTION"
  | "ONE_TIME_PURCHASE";

export type RevenueProfitCents = {
  revenueCents: number;
  grossProfitCents: number;
};

/** Recurring platform subscription: profit is the platform portion; revenue adds estimated card processing on that portion. */
export function subscriptionRevenueProfit(platformProfitCents: number): RevenueProfitCents {
  const grossProfitCents = Math.max(0, Math.floor(platformProfitCents));
  const processingCents = estimateStripeProcessingFeeCents(grossProfitCents);
  return {
    grossProfitCents,
    revenueCents: grossProfitCents + processingCents,
  };
}

/** One-time non-service checkout: revenue is base + all Match Fit fees; gross profit excludes only processor cost. */
export function oneTimePurchaseRevenueProfit(breakdown: CheckoutFeeBreakdown): RevenueProfitCents {
  const revenueCents = breakdown.totalChargedCents;
  const grossProfitCents = Math.max(0, revenueCents - breakdown.processingCents);
  return { revenueCents, grossProfitCents };
}

/** One-time charge when only total collected is known (legacy rows): profit = total − estimated processor fee. */
export function oneTimePurchaseRevenueProfitFromTotalCharged(totalChargedCents: number): RevenueProfitCents {
  const revenueCents = Math.max(0, Math.floor(totalChargedCents));
  const processingCents = estimateStripeProcessingFeeCents(revenueCents);
  return {
    revenueCents,
    grossProfitCents: Math.max(0, revenueCents - processingCents),
  };
}

/**
 * Coach–client service checkout:
 * - Revenue = gross amount collected on the card.
 * - Gross profit ≈ administrative fee (coach subtotal is pass-through).
 */
export function serviceCheckoutRevenueProfit(args: {
  amountCents: number;
  totalChargedCents?: number | null;
  adminFeeCents?: number | null;
  ledgerGrossTotalCents?: number | null;
}): RevenueProfitCents {
  const coachSubtotal = Math.max(0, Math.floor(args.amountCents));
  const adminFee = Math.max(
    0,
    Math.floor(args.adminFeeCents ?? adminFeeCentsFromBaseSubtotalCents(coachSubtotal)),
  );
  const revenueCents =
    args.ledgerGrossTotalCents != null && args.ledgerGrossTotalCents > 0
      ? Math.floor(args.ledgerGrossTotalCents)
      : args.totalChargedCents != null && args.totalChargedCents > 0
        ? Math.floor(args.totalChargedCents)
        : coachSubtotal + adminFee;
  return {
    revenueCents,
    grossProfitCents: adminFee,
  };
}
