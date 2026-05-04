import {
  type BillingUnit,
  serviceOfferingIsDiyTemplate,
  type MatchServiceId,
} from "@/lib/trainer-match-questionnaire";
import type { PublishedPurchaseSku } from "@/lib/trainer-service-offerings";

export type BookingPurchaseMeta = {
  serviceId: string;
  billingUnit: BillingUnit;
  sessionCreditsGranted: number;
  bookingUnlimitedPurchase: boolean;
};

/** Derives how a paid checkout affects booking credits and session caps. */
export function bookingPurchaseMetaFromSku(sku: PublishedPurchaseSku): BookingPurchaseMeta {
  const sid = sku.serviceId as MatchServiceId;
  if (serviceOfferingIsDiyTemplate(sid)) {
    return {
      serviceId: sku.serviceId,
      billingUnit: sku.billingUnit,
      sessionCreditsGranted: 0,
      bookingUnlimitedPurchase: true,
    };
  }
  if (sku.billingUnit === "per_month") {
    return {
      serviceId: sku.serviceId,
      billingUnit: sku.billingUnit,
      sessionCreditsGranted: 0,
      bookingUnlimitedPurchase: true,
    };
  }
  if (sku.billingUnit === "multi_session") {
    const n = Math.max(1, Math.min(52, sku.bundleQuantity || 1));
    return {
      serviceId: sku.serviceId,
      billingUnit: sku.billingUnit,
      sessionCreditsGranted: n,
      bookingUnlimitedPurchase: false,
    };
  }
  if (sku.billingUnit === "per_session") {
    const n = Math.max(1, Math.min(20, Math.floor(sku.bundleQuantity || 1)));
    return {
      serviceId: sku.serviceId,
      billingUnit: sku.billingUnit,
      sessionCreditsGranted: n,
      bookingUnlimitedPurchase: false,
    };
  }
  return {
    serviceId: sku.serviceId,
    billingUnit: sku.billingUnit,
    sessionCreditsGranted: 1,
    bookingUnlimitedPurchase: false,
  };
}
