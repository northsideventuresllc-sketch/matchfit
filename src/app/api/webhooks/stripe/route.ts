import { finalizeRegistrationAfterPayment } from "@/lib/billing-finalize";
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
          await recordTrainerServiceTransactionAndReward({
            clientId: md.clientId,
            trainerId: md.trainerId,
            amountCents,
            stripeCheckoutSessionId: session.id,
            source: "STRIPE_CHECKOUT",
          });
        }
      }
      if (session.mode === "subscription" && session.payment_status === "paid") {
        const sub = session.subscription;
        const subId = typeof sub === "string" ? sub : sub?.id;
        if (subId) {
          await finalizeRegistrationAfterPayment(subId);
        }
      }
    }
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      };
      const subId = invoice.subscription;
      if (typeof subId === "string") {
        await finalizeRegistrationAfterPayment(subId);
        await syncClientSubscriptionFromStripe(subId);
      }
    }
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.id) {
        await syncClientSubscriptionFromStripe(sub.id);
      }
    }
  } catch (e) {
    console.error("Stripe webhook handler error:", e);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
