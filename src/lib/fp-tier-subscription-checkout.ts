import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";
import type { FpAccountTier } from "@/lib/fp-account-tier-types";
import { isFpAccountTier } from "@/lib/fp-account-tier-types";
import {
  fpStripeSubscriptionPurposeForTier,
  fpStripePriceEnvKeyForTier,
} from "@/lib/fp-tier-billing";
import { resolveListingStatusAfterTierSwitch } from "@/lib/fp-tier-switching";
import type { FpDocSubmissionSummary } from "@/lib/fp-tier-docs";

export async function createFpTierCheckoutSession(
  trainerId: string,
  email: string,
  tier: FpAccountTier,
  successUrl: string,
  cancelUrl: string,
  switchFromTier?: FpAccountTier | null,
): Promise<{ url: string; sessionId: string } | { error: string }> {
  const stripe = getStripe();
  const priceEnvKey = fpStripePriceEnvKeyForTier(tier);
  const purpose = fpStripeSubscriptionPurposeForTier(tier);
  if (!stripe || !priceEnvKey || !purpose) {
    return { error: "Paid tier billing is not configured for this account type." };
  }

  const priceId = process.env[priceEnvKey]?.trim();
  if (!priceId) {
    return { error: "Paid tier billing is not configured." };
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

  // switchFromTier marks this checkout as an existing trainer switching INTO a paid tier
  // (as opposed to first-time signup checkout) so the webhook knows to promote accountTier
  // and log tierSwitchHistory once Stripe confirms the subscription, instead of granting the
  // tier synchronously at request time. See activateFpTierSubscriptionFromWebhook below.
  const metadata: Record<string, string> = { trainerId, purpose, fpTier: tier };
  if (switchFromTier) metadata.switchFromTier = switchFromTier;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata,
    },
    metadata,
  });

  if (!session.url) {
    return { error: "Could not create checkout session." };
  }

  return { url: session.url, sessionId: session.id };
}

/**
 * Activates an FP tier Stripe subscription after Stripe confirms it (checkout.session.completed
 * -> customer.subscription.created/updated). Always syncs stripeSubscriptionActive. When the
 * subscription's metadata.fpTier differs from the trainer's current accountTier, this is either
 * a first paid-tier grant or a confirmed tier switch (metadata.switchFromTier set by
 * createFpTierCheckoutSession) -- promotes accountTier, clears pendingTier, recomputes
 * listingStatus from current docs/background-check state, and (for a switch) logs
 * tierSwitchHistory. This is the fix for MF-TIER-SWITCH-NO-CHARGE: previously nothing ever
 * promoted accountTier off a Stripe event, so a trainer could "switch" to a paid tier and the
 * tier would never actually take effect even though createFpTierCheckoutSession existed.
 */
export async function activateFpTierSubscriptionFromWebhook(subscriptionId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const trainerId = sub.metadata?.trainerId?.trim();
  const fpTierRaw = sub.metadata?.fpTier?.trim();
  if (!trainerId || !fpTierRaw || !isFpAccountTier(fpTierRaw)) return;
  const fpTier = fpTierRaw;
  const switchFromTierRaw = sub.metadata?.switchFromTier?.trim() || null;
  const switchFromTier = switchFromTierRaw && isFpAccountTier(switchFromTierRaw) ? switchFromTierRaw : null;
  const active = sub.status === "active" || sub.status === "trialing";

  await prisma.trainer.update({
    where: { id: trainerId },
    data: {
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionActive: active,
    },
  });

  if (!active) return;

  const profile = await prisma.trainerProfile.findUnique({
    where: { trainerId },
    select: { accountTier: true, backgroundCheckPassed: true, docsApproved: true },
  });
  if (!profile || profile.accountTier === fpTier) return; // already applied (duplicate/replayed webhook)

  const docs = await prisma.fpDocument.findMany({
    where: { trainerId },
    select: { docType: true, status: true, fileUrl: true },
  });
  const listingStatus = resolveListingStatusAfterTierSwitch(
    fpTier,
    profile,
    docs as FpDocSubmissionSummary[],
  );

  await prisma.$transaction(async (tx) => {
    await tx.trainerProfile.update({
      where: { trainerId },
      data: { accountTier: fpTier, pendingTier: null, listingStatus },
    });
    if (switchFromTier) {
      await tx.tierSwitchHistory.create({
        data: { trainerId, fromTier: switchFromTier, toTier: fpTier, initiatedBy: "trainer" },
      });
    }
  });
}

export async function deactivateFpTierSubscription(trainerId: string): Promise<void> {
  await prisma.trainer.update({
    where: { id: trainerId },
    data: {
      stripeSubscriptionActive: false,
    },
  });
}
