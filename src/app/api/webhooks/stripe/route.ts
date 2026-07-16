import { finalizeRegistrationAfterPayment } from "@/lib/billing-finalize";
import {
  activateVipFromWebhook,
  deactivateVip,
  isClientVipSubscription,
  resolveClientIdFromVipSubscription,
} from "@/lib/client-vip-subscription";
import {
  activateFpTierSubscriptionFromWebhook,
  deactivateFpTierSubscription,
} from "@/lib/fp-tier-subscription-checkout";
import { creditFpNudgePackFromCheckout } from "@/lib/fp-nudge-pack-checkout";
import { FP_STRIPE_CHECKOUT_PURPOSE } from "@/lib/fp-tier-billing";
import { FP_NUDGE_PACK_SIZE } from "@/lib/fp-tier-chat-policy";
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
import { trackServerConversion } from "@/lib/server-conversion-tracking";
import { readStripeWebhookRawBody } from "@/lib/stripe-webhook-raw-body";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

function trackStripePurchaseConversion(input: {
  event: string;
  userId?: string;
  email?: string;
  amountCents?: number;
  checkoutSessionId?: string;
}): void {
  const value =
    typeof input.amountCents === "number" && Number.isFinite(input.amountCents) && input.amountCents > 0
      ? Math.round(input.amountCents) / 100
      : undefined;
  void trackServerConversion({
    event: input.event,
    userId: input.userId,
    email: input.email,
    value,
    currency: value != null ? "USD" : undefined,
    eventId: input.checkoutSessionId ? `stripe_cs_${input.checkoutSessionId}_${input.event}` : undefined,
    eventSourceUrl: "https://match-fit.net/",
  }).catch((err) => console.error("[stripe webhook] CAPI purchase track failed", input.event, err));
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await readStripeWebhookRawBody(req);

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
          trackStripePurchaseConversion({
            event: "trainer_registration_fee_purchase",
            userId: trainerId,
            email: trainer?.email ?? undefined,
            amountCents: paidCents,
            checkoutSessionId: session.id,
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
          trackStripePurchaseConversion({
            event: "trainer_promo_tokens_purchase",
            userId: String(md.trainerId),
            amountCents: totalMeta || promoBreakdown.revenueCents,
            checkoutSessionId: session.id,
          });
        }
        if (md.purpose === FP_STRIPE_CHECKOUT_PURPOSE.nudgePackPurchase && md.trainerId) {
          const trainerId = String(md.trainerId).trim();
          const packSize = Math.max(
            1,
            parseInt(String(md.nudgePackSize ?? FP_NUDGE_PACK_SIZE), 10) || FP_NUDGE_PACK_SIZE,
          );
          await creditFpNudgePackFromCheckout(trainerId, packSize);
          const totalMeta = Math.max(0, parseInt(String(session.amount_total ?? "0"), 10) || 0);
          const nudgeBreakdown = oneTimePurchaseRevenueProfitFromTotalCharged(totalMeta);
          void recordPlatformRevenueEvent({
            category: "ONE_TIME_PURCHASE",
            idempotencyKey: `fp_nudge_pack:${session.id}`,
            revenueCents: nudgeBreakdown.revenueCents,
            grossProfitCents: nudgeBreakdown.grossProfitCents,
            trainerId,
            billingLiveMode,
            metaJson: JSON.stringify({
              purpose: FP_STRIPE_CHECKOUT_PURPOSE.nudgePackPurchase,
              packSize,
            }),
          });
          trackStripePurchaseConversion({
            event: "fp_nudge_pack_purchase",
            userId: trainerId,
            amountCents: totalMeta,
            checkoutSessionId: session.id,
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
          trackStripePurchaseConversion({
            event: "trainer_service_purchase",
            userId: String(md.clientId),
            amountCents: totalChargedCents || amountCents,
            checkoutSessionId: session.id,
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
              const purpose = String(subObj.metadata?.purpose ?? md.purpose ?? "").trim();
              const amountCents =
                typeof session.amount_total === "number" && session.amount_total > 0
                  ? session.amount_total
                  : undefined;
              if (purpose === "client_vip" || isClientVipSubscription(subObj)) {
                const clientId =
                  (await resolveClientIdFromVipSubscription(subObj)) ??
                  (typeof md.clientId === "string" ? md.clientId : undefined);
                trackStripePurchaseConversion({
                  event: "client_vip_purchase",
                  userId: clientId ?? undefined,
                  email: typeof session.customer_details?.email === "string" ? session.customer_details.email : undefined,
                  amountCents,
                  checkoutSessionId: session.id,
                });
              } else {
                trackStripePurchaseConversion({
                  event: "client_membership_purchase",
                  userId: typeof md.clientId === "string" ? md.clientId : undefined,
                  email: typeof session.customer_details?.email === "string" ? session.customer_details.email : undefined,
                  amountCents,
                  checkoutSessionId: session.id,
                });
              }
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
        const paidAtUnix = invoice.status_transitions?.paid_at;
        const paidAt =
          typeof paidAtUnix === "number" && Number.isFinite(paidAtUnix) && paidAtUnix > 0
            ? new Date(paidAtUnix * 1000)
            : new Date();

        const stripe = getStripe();
        let handledVipInvoice = false;
        if (stripe) {
          try {
            const subObj = await stripe.subscriptions.retrieve(subId);
            if (isClientVipSubscription(subObj)) {
              handledVipInvoice = true;
              const clientId = await resolveClientIdFromVipSubscription(subObj);
              if (clientId) {
                await prisma.client.updateMany({
                  where: { vipSubscriptionId: subId },
                  data: { stripeLastSubscriptionInvoicePaidAt: paidAt },
                });
                void recordClientSubscriptionInvoiceEvent({
                  stripeInvoiceId: invoice.id,
                  clientId,
                  occurredAt: paidAt,
                  billingLiveMode,
                });
              }
            }
          } catch (e) {
            console.error("[stripe webhook] VIP invoice lookup failed", e);
          }
        }

        if (!handledVipInvoice) {
          await finalizeRegistrationAfterPayment(subId);
          await syncClientSubscriptionFromStripe(subId);
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
      if (sub.id) {
        const purpose = sub.metadata?.purpose?.trim();
        if (purpose === "client_vip" || isClientVipSubscription(sub)) {
          const clientId = await resolveClientIdFromVipSubscription(sub);
          if (clientId) {
            const st = String(sub.status ?? "");
            if (event.type === "customer.subscription.deleted" || st === "canceled" || st === "unpaid") {
              await deactivateVip(clientId);
            } else if (st === "active" || st === "trialing") {
              await activateVipFromWebhook(sub.id);
            }
          }
        } else if (
          purpose === FP_STRIPE_CHECKOUT_PURPOSE.independentSubscription ||
          purpose === FP_STRIPE_CHECKOUT_PURPOSE.eliteSubscription
        ) {
          const trainerId = sub.metadata?.trainerId?.trim();
          const st = String(sub.status ?? "");
          if (trainerId) {
            if (event.type === "customer.subscription.deleted" || st === "canceled" || st === "unpaid") {
              await deactivateFpTierSubscription(trainerId);
            } else if (st === "active" || st === "trialing") {
              await activateFpTierSubscriptionFromWebhook(sub.id);
            }
          }
        } else {
          await syncClientSubscriptionFromStripe(sub.id);
          void notifyClientSubscriptionStripeEvent({
            stripeSubscriptionId: sub.id,
            stripeEventType: event.type,
          });
        }
      }
    }
    if (event.type === "customer.subscription.created") {
      const sub = event.data.object as Stripe.Subscription;
      const purpose = sub.metadata?.purpose?.trim();
      if ((purpose === "client_vip" || isClientVipSubscription(sub)) && sub.id) {
        const st = String(sub.status ?? "");
        if (st === "active" || st === "trialing") {
          await activateVipFromWebhook(sub.id);
        }
      }
      if (
        sub.id &&
        (purpose === FP_STRIPE_CHECKOUT_PURPOSE.independentSubscription ||
          purpose === FP_STRIPE_CHECKOUT_PURPOSE.eliteSubscription)
      ) {
        const st = String(sub.status ?? "");
        if (st === "active" || st === "trialing") {
          await activateFpTierSubscriptionFromWebhook(sub.id);
        }
      }
    }
  } catch (e) {
    console.error("Stripe webhook handler error:", e);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
