import { finalizeRegistrationAfterPayment } from "@/lib/billing-finalize";
import { prisma } from "@/lib/prisma";
import { notifyClientSubscriptionStripeEvent } from "@/lib/subscription-email-notify";
import { syncClientSubscriptionFromStripe } from "@/lib/stripe-sync-client-subscription";
import { getStripe } from "@/lib/stripe-server";
import {
  creditTokensFromStripePurchase,
  getPromoPackTierById,
  recordTrainerServiceTransactionAndReward,
  TOKENS_PER_USD_PACK,
} from "@/lib/trainer-promo-tokens";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Webhooks not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    console.error("Stripe webhook signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const md = session.metadata ?? {};
      if (session.mode === "payment" && session.payment_status === "paid") {
        if (md.purpose === "trainer_promo_tokens" && md.trainerId) {
          const tier = getPromoPackTierById(String(md.packTier ?? md.tier ?? "").trim());
          let tokens = tier?.tokens ?? 0;
          if (!tokens) {
            const fromMeta = parseInt(String(md.tokenAmount ?? "0"), 10);
            if (Number.isFinite(fromMeta) && fromMeta > 0) {
              tokens = Math.min(50_000, Math.max(1, fromMeta));
            }
          }
          if (!tokens) {
            const packCount = Math.max(1, Math.min(80, parseInt(String(md.packCount ?? "1"), 10) || 1));
            tokens = packCount * TOKENS_PER_USD_PACK;
          }
          await creditTokensFromStripePurchase(md.trainerId, session.id, tokens);
        }
        if (md.purpose === "trainer_service_sale" && md.trainerId && md.clientId) {
          const amountCents = Math.max(0, parseInt(String(md.amountCents ?? "0"), 10) || 0);
          const sessionCreditsGranted = Math.max(0, parseInt(String(md.sessionCreditsGranted ?? "0"), 10) || 0);
          const bookingUnlimitedPurchase = md.bookingUnlimited === "1" || md.bookingUnlimited === "true";
          const conversationId = typeof md.conversationId === "string" && md.conversationId.trim() ? md.conversationId.trim() : null;
          const serviceId = typeof md.serviceId === "string" && md.serviceId.trim() ? md.serviceId.trim() : null;
          const billingUnit = typeof md.billingUnit === "string" && md.billingUnit.trim() ? md.billingUnit.trim() : null;
          const purchaseLabelSnapshot =
            typeof md.serviceLabel === "string" && md.serviceLabel.trim() ? md.serviceLabel.trim().slice(0, 500) : null;
          const totalChargedCents = Math.max(0, parseInt(String(md.totalChargedCents ?? "0"), 10) || 0);
          const adminFeeCents = Math.max(0, parseInt(String(md.adminFeeCents ?? "0"), 10) || 0);
          const grossAddonAttributedCents = Math.max(0, parseInt(String(md.grossAddonAttributedCents ?? "0"), 10) || 0);
          const addonHoursPurchased = Math.max(0, parseInt(String(md.addonHoursPurchased ?? "0"), 10) || 0);
          let stripePaymentIntentId: string | null = null;
          try {
            const full = await stripe.checkout.sessions.retrieve(session.id, { expand: ["payment_intent"] });
            const pi = full.payment_intent;
            stripePaymentIntentId = typeof pi === "string" ? pi : pi && typeof pi === "object" && "id" in pi ? String(pi.id) : null;
          } catch (e) {
            console.error("[stripe webhook] could not expand payment_intent for checkout session", session.id, e);
          }
          await recordTrainerServiceTransactionAndReward({
            clientId: md.clientId,
            trainerId: md.trainerId,
            amountCents,
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId,
            totalChargedCents: totalChargedCents || null,
            adminFeeCents: adminFeeCents || null,
            source: "STRIPE_CHECKOUT",
            serviceId,
            billingUnit,
            purchaseLabelSnapshot,
            sessionCreditsGranted,
            bookingUnlimitedPurchase,
            conversationId,
            grossAddonAttributedCents: grossAddonAttributedCents || null,
            addonHoursPurchased: addonHoursPurchased || null,
          });
        }
      }
      if (session.mode === "subscription") {
        const paymentOk =
          session.payment_status === "paid" ||
          session.payment_status === "no_payment_required";
        if (paymentOk) {
          const sub = session.subscription;
          const subId = typeof sub === "string" ? sub : sub?.id;
          if (subId) {
            const subObj = await stripe.subscriptions.retrieve(subId);
            const st = String(subObj.status ?? "");
            if (st === "active" || st === "trialing") {
              await finalizeRegistrationAfterPayment(subId);
            }
          }
        }
      }
    }
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
        status_transitions?: { paid_at?: number | null };
      };
      const subId = invoice.subscription;
      if (typeof subId === "string") {
        await finalizeRegistrationAfterPayment(subId);
        await syncClientSubscriptionFromStripe(subId);
        const paidAtUnix = invoice.status_transitions?.paid_at;
        const paidAt =
          typeof paidAtUnix === "number" && Number.isFinite(paidAtUnix) && paidAtUnix > 0
            ? new Date(paidAtUnix * 1000)
            : new Date();
        await prisma.client.updateMany({
          where: { stripeSubscriptionId: subId },
          data: { stripeLastSubscriptionInvoicePaidAt: paidAt },
        });
      }
    }
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.id) {
        await syncClientSubscriptionFromStripe(sub.id);
        void notifyClientSubscriptionStripeEvent({
          stripeSubscriptionId: sub.id,
          stripeEventType: event.type,
        });
      }
    }
  } catch (e) {
    console.error("Stripe webhook handler error:", e);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
