import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";
import {
  FP_NUDGE_PACK_STRIPE_PRICE_ENV,
  FP_STRIPE_CHECKOUT_PURPOSE,
} from "@/lib/fp-tier-billing";
import { FP_NUDGE_PACK_SIZE } from "@/lib/fp-tier-chat-policy";

export async function createFpNudgePackCheckoutSession(
  trainerId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string; sessionId: string } | { error: string }> {
  const stripe = getStripe();
  const priceId = process.env[FP_NUDGE_PACK_STRIPE_PRICE_ENV]?.trim();
  if (!stripe || !priceId) {
    return { error: "Nudge pack billing is not configured." };
  }

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { stripeCustomerId: true, email: true },
  });
  if (!trainer) {
    return { error: "Account not found." };
  }

  let customerId = trainer.stripeCustomerId?.trim() || null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email.trim() || trainer.email,
      metadata: { trainerId },
    });
    customerId = customer.id;
    await prisma.trainer.update({
      where: { id: trainerId },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      trainerId,
      purpose: FP_STRIPE_CHECKOUT_PURPOSE.nudgePackPurchase,
      nudgePackSize: String(FP_NUDGE_PACK_SIZE),
    },
  });

  if (!session.url) {
    return { error: "Could not create checkout session." };
  }

  return { url: session.url, sessionId: session.id };
}

export async function creditFpNudgePackFromCheckout(trainerId: string, packSize: number): Promise<void> {
  if (!trainerId || packSize <= 0) return;
  await prisma.trainerProfile.update({
    where: { trainerId },
    data: { nudgeCreditsBalance: { increment: packSize } },
  });
}
