import { estimateStripeProcessingFeeCents } from "@/lib/financial-ledger-split";

/** Match Fit administrative fee on non-subscription purchases (Terms §3). */
export const PLATFORM_ADMIN_FEE_RATE = 0.2;

export const ADMIN_FEE_UI_LABEL = "Administrative fee (20%) — non-refundable";

export const PROCESSING_FEE_UI_LABEL = "Card processing fee";

/** Stripe line-item description for the admin portion. */
export const ADMIN_FEE_STRIPE_DESCRIPTION =
  "Match Fit administrative fee (20%). Non-refundable if the underlying service is cancelled or marked as a no-show.";

export const PROCESSING_FEE_STRIPE_DESCRIPTION =
  "Payment processing fee to cover card network and processor costs (estimated at checkout).";

export function adminFeeCentsFromBaseSubtotalCents(baseCents: number): number {
  if (!Number.isFinite(baseCents) || baseCents <= 0) return 0;
  return Math.round(baseCents * PLATFORM_ADMIN_FEE_RATE);
}

/** Stripe card processing estimate applied to every platform charge (see Terms §3). */
export function stripeProcessingFeeCents(chargeableSubtotalCents: number): number {
  return estimateStripeProcessingFeeCents(chargeableSubtotalCents);
}

export type MarketplaceCheckoutTotals = {
  baseCents: number;
  adminCents: number;
  processingCents: number;
  totalCents: number;
};

/** Coach services, tokens, and similar marketplace charges: base + optional 20% admin + processing. */
export function buildMarketplaceCheckoutTotals(
  baseCents: number,
  options: { includeAdminFee: boolean },
): MarketplaceCheckoutTotals {
  const adminCents = options.includeAdminFee ? adminFeeCentsFromBaseSubtotalCents(baseCents) : 0;
  const preProcessing = baseCents + adminCents;
  const processingCents = stripeProcessingFeeCents(preProcessing);
  return {
    baseCents,
    adminCents,
    processingCents,
    totalCents: preProcessing + processingCents,
  };
}

export type StripeCheckoutLineItem = {
  quantity: number;
  price_data: {
    currency: "usd";
    unit_amount: number;
    product_data: { name: string; description?: string };
  };
};

export function stripeLineItemsFromMarketplaceTotals(args: {
  baseLine: { name: string; description?: string };
  includeAdminFee: boolean;
  totals: MarketplaceCheckoutTotals;
}): StripeCheckoutLineItem[] {
  const items: StripeCheckoutLineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: args.totals.baseCents,
        product_data: { name: args.baseLine.name, description: args.baseLine.description },
      },
    },
  ];
  if (args.includeAdminFee && args.totals.adminCents > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: args.totals.adminCents,
        product_data: { name: ADMIN_FEE_UI_LABEL, description: ADMIN_FEE_STRIPE_DESCRIPTION },
      },
    });
  }
  if (args.totals.processingCents > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: args.totals.processingCents,
        product_data: { name: PROCESSING_FEE_UI_LABEL, description: PROCESSING_FEE_STRIPE_DESCRIPTION },
      },
    });
  }
  return items;
}
