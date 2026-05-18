import {
  computeCheckoutFeeBreakdown,
  feeMetadataFromBreakdown,
  stripeCheckoutLineItemsFromBreakdown,
} from "@/lib/stripe-checkout-line-items";
import { computeTrainerRegistrationDueCents } from "@/lib/trainer-registration-fee";
import type { TrainerRegistrationPricingMode } from "@/lib/match-fit-launch-promotions";
import { getStripe } from "@/lib/stripe-server";

export async function createTrainerRegistrationFeeCheckoutSession(args: {
  trainerId: string;
  email: string;
  pricingMode: TrainerRegistrationPricingMode;
  backgroundCheckVendorPaidCents: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; dueCents: number }> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Billing is not configured.");
  }

  const { dueCents, error } = computeTrainerRegistrationDueCents({
    pricingMode: args.pricingMode,
    backgroundCheckVendorPaidCents: args.backgroundCheckVendorPaidCents,
  });
  if (error || dueCents <= 0) {
    throw new Error(error ?? "No registration fee is due.");
  }

  const breakdown = computeCheckoutFeeBreakdown({
    baseCents: dueCents,
    includeAdminFee: false,
    includeProcessingFee: true,
  });

  const modeLabel =
    args.pricingMode === "FOUNDING_BG_SURCHARGE_20PCT"
      ? "Founding coach — 20% of background check"
      : "Platform registration (after background check credit)";

  const metadata: Record<string, string> = {
    purpose: "trainer_registration_fee",
    trainerId: args.trainerId,
    pricingMode: args.pricingMode,
    backgroundCheckVendorPaidCents: String(args.backgroundCheckVendorPaidCents),
    ...feeMetadataFromBreakdown(breakdown),
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: args.email,
    line_items: stripeCheckoutLineItemsFromBreakdown({
      breakdown,
      baseName: "Match Fit trainer registration",
      baseDescription: modeLabel,
      includeAdminFee: false,
      includeProcessingFee: true,
    }),
    metadata,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Could not start checkout.");
  }
  return { url: session.url, dueCents: breakdown.baseCents };
}
