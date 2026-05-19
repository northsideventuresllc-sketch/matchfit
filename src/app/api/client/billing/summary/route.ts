import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export async function GET() {
  try {
    const clientId = await getSessionClientId();
    if (!clientId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionActive: true,
        subscriptionGraceUntil: true,
        subscriptionTrialEndsAt: true,
        clientTrialPlan: true,
      },
    });
    if (!client) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const stripe = getStripe();
    let nextBillingDate: string | null = null;
    let subscriptionStatus: string | null = null;
    let cancelAtPeriodEnd = false;
    let defaultPaymentSummary: string | null = null;
    let paymentMethodCount = 0;

    if (stripe && client.stripeSubscriptionId) {
      try {
        const sub = (await stripe.subscriptions.retrieve(client.stripeSubscriptionId, {
          expand: ["default_payment_method"],
        })) as Stripe.Subscription & { current_period_end?: number; trial_end?: number | null };
        subscriptionStatus = sub.status;
        cancelAtPeriodEnd = sub.cancel_at_period_end;
        const billAt =
          sub.status === "trialing" && sub.trial_end
            ? sub.trial_end
            : sub.current_period_end;
        if (billAt) {
          nextBillingDate = new Date(billAt * 1000).toISOString();
        }
        const pm = sub.default_payment_method as Stripe.PaymentMethod | string | null | undefined;
        if (typeof pm === "object" && pm && pm.type === "card" && pm.card) {
          defaultPaymentSummary = `${pm.card.brand?.toUpperCase() ?? "CARD"} •••• ${pm.card.last4}`;
        }
      } catch {
        /* non-fatal */
      }
    }

    if (stripe && client.stripeCustomerId) {
      try {
        const pms = await stripe.paymentMethods.list({
          customer: client.stripeCustomerId,
          type: "card",
        });
        paymentMethodCount = pms.data.length;
      } catch {
        /* non-fatal */
      }
    }

    return NextResponse.json({
      hasStripeCustomer: Boolean(client.stripeCustomerId),
      hasSubscription: Boolean(client.stripeSubscriptionId),
      stripeSubscriptionActive: client.stripeSubscriptionActive,
      subscriptionGraceUntil: client.subscriptionGraceUntil?.toISOString() ?? null,
      subscriptionTrialEndsAt: client.subscriptionTrialEndsAt?.toISOString() ?? null,
      clientTrialPlan: client.clientTrialPlan,
      nextBillingDate,
      subscriptionStatus,
      cancelAtPeriodEnd,
      defaultPaymentSummary,
      paymentMethodCount,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not load billing summary." }, { status: 500 });
  }
}
