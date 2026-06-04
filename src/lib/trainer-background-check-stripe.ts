import { defaultBackgroundCheckVendorPaidCents } from "@/lib/checkr";
import { prisma } from "@/lib/prisma";
import { syncTrainerComplianceWindow } from "@/lib/trainer-compliance-window-sync";
import { getStripe } from "@/lib/stripe-server";
import type Stripe from "stripe";

export const TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE = "trainer_background_check_fee";

/** Amount charged for background screening (cents). */
export function trainerBackgroundCheckAmountCents(): number {
  const usd = process.env.NEXT_PUBLIC_TRAINER_BACKGROUND_CHECK_FEE_USD?.trim();
  if (usd) {
    const n = Number.parseFloat(usd);
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100);
  }
  return defaultBackgroundCheckVendorPaidCents();
}

export function isTrainerBackgroundCheckPaymentIntent(pi: Stripe.PaymentIntent): boolean {
  return pi.metadata?.purpose === TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE;
}

export async function applyTrainerBackgroundCheckStripePayment(args: {
  trainerId: string;
  vendorPaidCents: number;
}): Promise<void> {
  const cents = Math.max(1, Math.floor(args.vendorPaidCents));
  const now = new Date();
  await prisma.trainerProfile.upsert({
    where: { trainerId: args.trainerId },
    create: {
      trainerId: args.trainerId,
      hasPaidBackgroundFee: true,
      backgroundCheckVendorPaidCents: cents,
      backgroundCheckStatus: "PENDING",
      backgroundCheckReviewStatus: "PENDING",
    },
    update: {
      hasPaidBackgroundFee: true,
      backgroundCheckVendorPaidCents: cents,
      backgroundCheckStatus: "PENDING",
      backgroundCheckReviewStatus: "PENDING",
      updatedAt: now,
    },
  });
  await syncTrainerComplianceWindow(args.trainerId);
}

export async function createTrainerBackgroundCheckPaymentIntent(args: {
  trainerId: string;
  email: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const amount = trainerBackgroundCheckAmountCents();
  const pi = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    receipt_email: args.email,
    automatic_payment_methods: { enabled: true },
    metadata: {
      purpose: TRAINER_BACKGROUND_CHECK_STRIPE_PURPOSE,
      trainerId: args.trainerId,
      vendorPaidCents: String(amount),
    },
  });

  if (!pi.client_secret) {
    throw new Error("Stripe did not return a client secret for this payment.");
  }

  return { clientSecret: pi.client_secret, paymentIntentId: pi.id };
}

export async function confirmTrainerBackgroundCheckPaymentIntent(args: {
  trainerId: string;
  paymentIntentId: string;
}): Promise<void> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const pi = await stripe.paymentIntents.retrieve(args.paymentIntentId);
  if (!isTrainerBackgroundCheckPaymentIntent(pi)) {
    throw new Error("This payment is not a background check charge.");
  }
  if (pi.metadata?.trainerId !== args.trainerId) {
    throw new Error("Payment does not belong to this trainer.");
  }
  if (pi.status !== "succeeded") {
    throw new Error("Payment has not completed yet.");
  }

  const cents =
    typeof pi.amount_received === "number" && pi.amount_received > 0
      ? pi.amount_received
      : trainerBackgroundCheckAmountCents();

  await applyTrainerBackgroundCheckStripePayment({
    trainerId: args.trainerId,
    vendorPaidCents: cents,
  });
}
