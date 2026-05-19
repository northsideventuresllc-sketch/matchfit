import {
  adminFeeCentsFromBaseSubtotalCents,
  ADMIN_FEE_STRIPE_DESCRIPTION,
  ADMIN_FEE_UI_LABEL,
} from "@/lib/platform-fees";
import { estimateStripeProcessingFeeCents } from "@/lib/stripe-processing-fee";

export const PROCESSING_FEE_UI_LABEL = "Estimated card processing fee";
export const PROCESSING_FEE_STRIPE_DESCRIPTION =
  "Estimated payment network and processor cost (2.9% + $0.30). Non-refundable.";

export type CheckoutFeeBreakdown = {
  baseCents: number;
  adminCents: number;
  processingCents: number;
  totalChargedCents: number;
};

export function computeCheckoutFeeBreakdown(args: {
  baseCents: number;
  includeAdminFee?: boolean;
  includeProcessingFee?: boolean;
}): CheckoutFeeBreakdown {
  const baseCents = Math.max(0, Math.floor(args.baseCents));
  const adminCents = args.includeAdminFee ? adminFeeCentsFromBaseSubtotalCents(baseCents) : 0;
  const subtotalBeforeProcessing = baseCents + adminCents;
  const processingCents =
    args.includeProcessingFee === false ? 0 : estimateStripeProcessingFeeCents(subtotalBeforeProcessing);
  return {
    baseCents,
    adminCents,
    processingCents,
    totalChargedCents: subtotalBeforeProcessing + processingCents,
  };
}

type LineItem = {
  quantity: number;
  price_data: {
    currency: string;
    unit_amount: number;
    product_data: { name: string; description?: string };
  };
};

export function stripeCheckoutLineItemsFromBreakdown(args: {
  breakdown: CheckoutFeeBreakdown;
  baseName: string;
  baseDescription?: string;
  includeAdminFee?: boolean;
  includeProcessingFee?: boolean;
}): LineItem[] {
  const items: LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: args.breakdown.baseCents,
        product_data: {
          name: args.baseName,
          ...(args.baseDescription ? { description: args.baseDescription } : {}),
        },
      },
    },
  ];
  if (args.includeAdminFee && args.breakdown.adminCents > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: args.breakdown.adminCents,
        product_data: {
          name: ADMIN_FEE_UI_LABEL,
          description: ADMIN_FEE_STRIPE_DESCRIPTION,
        },
      },
    });
  }
  if (args.includeProcessingFee !== false && args.breakdown.processingCents > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: args.breakdown.processingCents,
        product_data: {
          name: PROCESSING_FEE_UI_LABEL,
          description: PROCESSING_FEE_STRIPE_DESCRIPTION,
        },
      },
    });
  }
  return items;
}

export function feeMetadataFromBreakdown(breakdown: CheckoutFeeBreakdown): Record<string, string> {
  return {
    baseCents: String(breakdown.baseCents),
    adminFeeCents: String(breakdown.adminCents),
    processingFeeCents: String(breakdown.processingCents),
    totalChargedCents: String(breakdown.totalChargedCents),
  };
}
