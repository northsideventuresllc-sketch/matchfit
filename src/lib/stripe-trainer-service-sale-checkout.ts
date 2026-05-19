import {
  buildMarketplaceCheckoutTotals,
  stripeLineItemsFromMarketplaceTotals,
} from "@/lib/platform-fees";
import { bookingPurchaseMetaFromSku } from "@/lib/trainer-booking-purchase-meta";
import {
  computeCheckoutFeeBreakdown,
  feeMetadataFromBreakdown,
  stripeCheckoutLineItemsFromBreakdown,
} from "@/lib/stripe-checkout-line-items";
import type { TrainerServiceOfferingLine } from "@/lib/trainer-service-offerings";
import { publishedPurchaseSkusFromLine, resolvedTrainerServicePublicTitle, type PublishedPurchaseSku } from "@/lib/trainer-service-offerings";
import { getStripe } from "@/lib/stripe-server";

export async function createTrainerServiceSaleStripeCheckoutSession(args: {
  trainerId: string;
  trainerUsername: string;
  clientId: string;
  clientEmail: string;
  line: TrainerServiceOfferingLine;
  overridePriceUsd?: number;
  checkoutTitle?: string;
  extraMetadata?: Record<string, string>;
  conversationId?: string | null;
  purchaseSku?: PublishedPurchaseSku | null;
  checkoutContext?: "profile" | "chat";
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Billing is not configured.");
  }

  const priceUsd = args.overridePriceUsd ?? args.line.priceUsd;
  const baseCents = Math.round(priceUsd * 100);
  if (!Number.isFinite(baseCents) || baseCents < 1500 || baseCents > 5_000_000) {
    throw new Error("Service price is not valid for checkout.");
  }

  const totals = buildMarketplaceCheckoutTotals(baseCents, { includeAdminFee: true });
  const { adminCents, processingCents, totalCents } = totals;
  const breakdown = computeCheckoutFeeBreakdown({ baseCents, includeAdminFee: true, includeProcessingFee: true });
  const catalogTitle = resolvedTrainerServicePublicTitle(args.line);
  const displayTitle = (args.checkoutTitle ?? catalogTitle).trim().slice(0, 120);
  const serviceLabel = displayTitle.slice(0, 240);

  const sku = args.purchaseSku ?? publishedPurchaseSkusFromLine(args.line)[0]!;
  const bookingMeta = bookingPurchaseMetaFromSku(sku);

  const metadata: Record<string, string> = {
    purpose: "trainer_service_sale",
    trainerId: args.trainerId,
    clientId: args.clientId,
    amountCents: String(baseCents),
    totalChargedCents: String(totalCents),
    adminFeeCents: String(adminCents),
    processingFeeCents: String(processingCents),
    amountCents: String(breakdown.baseCents),
    ...feeMetadataFromBreakdown(breakdown),
    serviceId: bookingMeta.serviceId,
    billingUnit: bookingMeta.billingUnit,
    sessionCreditsGranted: String(bookingMeta.sessionCreditsGranted),
    bookingUnlimited: bookingMeta.bookingUnlimitedPurchase ? "1" : "0",
    serviceLabel,
  };
  if (args.extraMetadata) {
    for (const [k, v] of Object.entries(args.extraMetadata)) {
      if (v.length <= 500) metadata[k] = v;
    }
  }
  if (args.conversationId) {
    metadata.conversationId = args.conversationId;
  }
  metadata.checkoutContext = args.checkoutContext === "chat" ? "chat" : "profile";

  const grossAddonMeta = Math.max(0, parseInt(String(metadata.grossAddonAttributedCents ?? "0"), 10) || 0);
  const addonHoursMeta = Math.max(0, parseInt(String(metadata.addonHoursPurchased ?? "0"), 10) || 0);
  metadata.grossAddonAttributedCents = String(grossAddonMeta);
  metadata.addonHoursPurchased = String(addonHoursMeta);

  const line_items = stripeLineItemsFromMarketplaceTotals({
    totals,
    includeAdminFee: true,
    baseLine: {
      name: `Coach service — ${displayTitle}`,
      description: `Match Fit platform checkout for services with @${args.trainerUsername}. Service subtotal before fees.`,
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: args.clientEmail,
    line_items,
    line_items: stripeCheckoutLineItemsFromBreakdown({
      breakdown,
      baseName: `Coach service — ${displayTitle}`,
      baseDescription: `Match Fit checkout for services with @${args.trainerUsername}.`,
      includeAdminFee: true,
      includeProcessingFee: true,
    }),
    metadata,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Could not start checkout.");
  }
  return session.url;
}
