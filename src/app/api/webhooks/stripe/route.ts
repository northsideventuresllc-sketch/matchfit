import { finalizeRegistrationAfterPayment } from "@/lib/billing-finalize";
import {
  notifyClientMembershipTrialEnding,
  notifyTrainerRegistrationFeeReceipt,
} from "@/lib/client-membership-email-notify";
import { prisma } from "@/lib/prisma";
import { notifyClientSubscriptionStripeEvent } from "@/lib/subscription-email-notify";
import { syncClientSubscriptionFromStripe } from "@/lib/stripe-sync-client-subscription";
import {
  applyTrainerBackgroundCheckStripePayment,
  isTrainerBackgroundCheckPaymentIntent,
} from "@/lib/trainer-background-check-stripe";
import { syncTrainerComplianceWindow } from "@/lib/trainer-compliance-window-sync";
import {
  isTrainerSignupBackgroundEscrowPaymentIntent,
  isTrainerSignupPlatformHoldPaymentIntent,
  TRAINER_SIGNUP_FEE_HOLD_PURPOSE,
} from "@/lib/trainer-signup-fee-hold";
import {
  applyTrainerSignupBackgroundEscrowHoldAuthorized,
  applyTrainerSignupFeeHoldAuthorized,
  applyTrainerSignupPlatformHoldAuthorized,
} from "@/lib/trainer-compliance-window-sync";
import { getStripe } from "@/lib/stripe-server";
import {
  oneTimePurchaseRevenueProfit,
  oneTimePurchaseRevenueProfitFromTotalCharged,
} from "@/lib/platform-revenue-accounting";
import {
  recordClientSubscriptionInvoiceEvent,
  recordPlatformRevenueEvent,
} from "@/lib/platform-revenue-events";
import {
  creditTokensFromStripePurchase,
  getPromoPackTierById,
  recordTrainerServiceTransactionAndReward,
  TOKENS_PER_USD_PACK,
} from "@/lib/trainer-promo-tokens";
import { computeCheckoutFeeBreakdown } from "@/lib/stripe-checkout-line-items";
import { hydrateStripeEnvFromDatabase } from "@/lib/hydrate-stripe-env";
import {
  activateVipFromWebhook,
  deactivateVip,
  deactivateVipBySubscriptionId,
} from "@/lib/client-vip-subscription";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await hydrateStripeEnvFromDatabase();
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
    const billingLiveMode = event.livemode === true;
    if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.amount_capturable_updated") {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.status === "requires_capture") {
        const trainerId = String(pi.metadata?.trainerId ?? "").trim();
        if (trainerId && isTrainerSignupPlatformHoldPaymentIntent(pi)) {
          const paidCents = typeof pi.amount === "number" && pi.amount > 0 ? pi.amount : 0;
          const pricingMode =
            pi.metadata?.pricingMode === "STANDARD_100_MINUS_BG"
              ? "STANDARD_100_MINUS_BG"
              : "FOUNDING_BG_SURCHARGE_20PCT";
          await applyTrainerSignupPlatformHoldAuthorized({
            trainerId,
            paymentIntentId: pi.id,
            pendingBackgroundCheckEscrowPaymentIntentId:
              pi.metadata?.backgroundCheckPaymentIntentId?.trim() || null,
            paidCents,
            pricingMode,
          });
        } else if (trainerId && isTrainerSignupBackgroundEscrowPaymentIntent(pi)) {
          await applyTrainerSignupBackgroundEscrowHoldAuthorized({
            trainerId,
            paymentIntentId: pi.id,
          });
        } else if (trainerId && pi.metadata?.purpose === TRAINER_SIGNUP_FEE_HOLD_PURPOSE) {
          const paidCents =
            typeof pi.amount === "number" && pi.amount > 0
              ? pi.amount
              : Math.max(0, parseInt(String(pi.metadata?.totalChargedCents ?? "0"), 10) || 0);
          await applyTrainerSignupFeeHoldAuthorized({
            trainerId,
            paymentIntentId: pi.id,
            paidCents,
          });
        }
      }
      if (isTrainerBackgroundCheckPaymentIntent(pi)) {
        const trainerId = String(pi.metadata?.trainerId ?? "").trim();
        if (trainerId) {
          const cents =
            typeof pi.amount_received === "number" && pi.amount_received > 0
              ? pi.amount_received
              : Math.max(0, parseInt(String(pi.metadata?.vendorPaidCents ?? "0"), 10) || 0);
          if (cents > 0) {
            await applyTrainerBackgroundCheckStripePayment({ trainerId, vendorPaidCents: cents });
            await syncTrainerComplianceWindow(trainerId);
          }
        }
      }
    }
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const md = session.metadata ?? {};
      if (session.mode === "payment" && session.payment_status === "paid") {
        if (md.purpose === "trainer_registration_fee" && md.trainerId) {
          const trainerId = String(md.trainerId).trim();
          const totalChargedCents = Math.max(0, parseInt(String(md.totalChargedCents ?? "0"), 10) || 0);
          const baseCents = Math.max(0, parseInt(String(md.baseCents ?? "0"), 10) || 0);
          const paidCents = totalChargedCents || baseCents;
          await prisma.trainerProfile.updateMany({
            where: { trainerId },
            data: {
              hasPaidRegistrationFee: true,
              registrationFeePaidCents: paidCents > 0 ? paidCents : undefined,
              updatedAt: new Date(),
            },
          });
          const trainer = await prisma.trainer.findUnique({
            where: { id: trainerId },
            select: { email: true },
          });
          if (trainer?.email) {
            const dollars = (paidCents / 100).toFixed(2);
            void notifyTrainerRegistrationFeeReceipt({
              trainerId,
              email: trainer.email,
              amountLabel: `$${dollars}`,
            });
          }
          const baseCentsMeta = Math.max(0, parseInt(String(md.baseCents ?? "0"), 10) || 0);
          const processingMeta = Math.max(0, parseInt(String(md.processingFeeCents ?? "0"), 10) || 0);
          const regBreakdown =
            baseCentsMeta > 0 && paidCents > 0
              ? oneTimePurchaseRevenueProfit({
                  baseCents: baseCentsMeta,
                  adminCents: 0,
                  processingCents: processingMeta,
                  totalChargedCents: paidCents,
                })
              : oneTimePurchaseRevenueProfitFromTotalCharged(paidCents);
          void recordPlatformRevenueEvent({
            category: "ONE_TIME_PURCHASE",
            idempotencyKey: `registration_checkout:${session.id}`,
            revenueCents: regBreakdown.revenueCents,
            grossProfitCents: regBreakdown.grossProfitCents,
            trainerId,
            billingLiveMode,
            metaJson: JSON.stringify({ purpose: "trainer_registration_fee" }),
          });
        }
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
          const baseCentsMeta = Math.max(0, parseInt(String(md.baseCents ?? "0"), 10) || 0);
          const adminMeta = Math.max(0, parseInt(String(md.adminFeeCents ?? "0"), 10) || 0);
          const processingMeta = Math.max(0, parseInt(String(md.processingFeeCents ?? "0"), 10) || 0);
          const totalMeta = Math.max(0, parseInt(String(md.totalChargedCents ?? "0"), 10) || 0);
          const promoBreakdown =
            baseCentsMeta > 0 && totalMeta > 0
              ? oneTimePurchaseRevenueProfit({
                  baseCents: baseCentsMeta,
                  adminCents: adminMeta,
                  processingCents: processingMeta,
                  totalChargedCents: totalMeta,
                })
              : tier
                ? oneTimePurchaseRevenueProfit(
                    computeCheckoutFeeBreakdown({
                      baseCents: tier.usdCents,
                      includeAdminFee: true,
                      includeProcessingFee: true,
                    }),
                  )
                : oneTimePurchaseRevenueProfitFromTotalCharged(totalMeta);
          void recordPlatformRevenueEvent({
            category: "ONE_TIME_PURCHASE",
            idempotencyKey: `promo_tokens:${session.id}`,
            revenueCents: promoBreakdown.revenueCents,
            grossProfitCents: promoBreakdown.grossProfitCents,
            trainerId: md.trainerId,
            billingLiveMode,
            metaJson: JSON.stringify({ purpose: "trainer_promo_tokens", packTier: tier?.id ?? null, tokens }),
          });
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
        const client = await prisma.client.findFirst({
          where: { stripeSubscriptionId: subId },
          select: { id: true },
        });
        if (client) {
          void recordClientSubscriptionInvoiceEvent({
            stripeInvoiceId: invoice.id,
            clientId: client.id,
            occurredAt: paidAt,
            billingLiveMode,
          });
        }
      }
    }
    if (event.type === "customer.subscription.trial_will_end") {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.id && sub.trial_end) {
        const trialEndLabel = new Date(sub.trial_end * 1000).toLocaleDateString("en-US", { dateStyle: "long" });
        void notifyClientMembershipTrialEnding({ stripeSubscriptionId: sub.id, trialEndLabel });
      }
    }
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const purpose = String(sub.metadata?.purpose ?? "").trim();
      if (purpose === "client_vip") {
        const clientId = String(sub.metadata?.clientId ?? "").trim();
        const status = String(sub.status ?? "").trim();
        if (event.type === "customer.subscription.deleted" || status === "canceled" || status === "unpaid") {
          if (clientId) {
            await deactivateVip(clientId);
          } else if (sub.id) {
            await deactivateVipBySubscriptionId(sub.id);
          }
        } else if (status === "active" || status === "trialing") {
          if (sub.id) {
            await activateVipFromWebhook(sub.id);
          }
        }
      } else if (sub.id) {
        await syncClientSubscriptionFromStripe(sub.id);
        void notifyClientSubscriptionStripeEvent({
          stripeSubscriptionId: sub.id,
          stripeEventType: event.type,
        });
      }
    }
    if (event.type === "customer.subscription.created") {
      const sub = event.data.object as Stripe.Subscription;
      if (String(sub.metadata?.purpose ?? "").trim() === "client_vip") {
        const status = String(sub.status ?? "").trim();
        if ((status === "active" || status === "trialing") && sub.id) {
          await activateVipFromWebhook(sub.id);
        }
      }
    }
  } catch (e) {
    console.error("Stripe webhook handler error:", e);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
