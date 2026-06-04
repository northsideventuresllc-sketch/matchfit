import { stripeObjectIsLiveBilling } from "@/lib/stripe-server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";

export type FinalizePaymentResult =
  | { ok: true; clientId: string; alreadyCompleted?: boolean }
  | { ok: false; error: string };

/**
 * Attaches a Stripe subscription to an existing client (payment grace or reactivation).
 * Clears platform deactivation flags when payment succeeds.
 */
export async function finalizeClientSubscriptionPayment(subscriptionId: string): Promise<FinalizePaymentResult> {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, error: "Billing is not configured." };
  }

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  if (sub.status !== "active" && sub.status !== "trialing") {
    return { ok: false, error: "Subscription is not active yet." };
  }

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const clientId = sub.metadata?.clientId;
  if (!clientId || typeof clientId !== "string") {
    return { ok: false, error: "Invalid subscription metadata." };
  }

  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, stripeSubscriptionId: true },
  });
  if (!existing) {
    return { ok: false, error: "Account not found." };
  }
  if (existing.stripeSubscriptionId === subscriptionId) {
    return { ok: true, clientId: existing.id, alreadyCompleted: true };
  }

  await prisma.client.update({
    where: { id: existing.id },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionActive: true,
      stripeBillingLiveMode: stripeObjectIsLiveBilling(sub.livemode),
      subscriptionGraceUntil: null,
      paymentGraceUntil: null,
      accountDeactivatedAt: null,
      stripeLastSubscriptionInvoicePaidAt: new Date(),
    },
  });

  return { ok: true, clientId: existing.id };
}
