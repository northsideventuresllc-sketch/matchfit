import {
  buildMarketplaceCheckoutTotals,
  stripeLineItemsFromMarketplaceTotals,
} from "@/lib/platform-fees";
import { bookingPurchaseMetaFromSku } from "@/lib/trainer-booking-purchase-meta";
import type { TrainerServiceOfferingLine } from "@/lib/trainer-service-offerings";
import { publishedPurchaseSkusFromLine, resolvedTrainerServicePublicTitle, type PublishedPurchaseSku } from "@/lib/trainer-service-offerings";
import { getStripe } from "@/lib/stripe-server";

export async function createTrainerServiceSaleStripeCheckoutSession(args: {
  trainerId: string;
  trainerUsername: string;
  clientId: string;
  clientEmail: string;
  line: TrainerServiceOfferingLine;
  /** When set, overrides `line.priceUsd` for the coach-service subtotal (e.g. a selected variation or bundle tier). */
  overridePriceUsd?: number;
  /** Primary line item title in Stripe (keep short). */
  checkoutTitle?: string;
  extraMetadata?: Record<string, string>;
  conversationId?: string | null;
  /** When set (e.g. client SKU picker), drives booking credit metadata on the Stripe session. */
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
    metadata,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Could not start checkout.");
  }
  return session.url;
}
