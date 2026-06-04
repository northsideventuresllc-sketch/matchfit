import { purgeExpiredRegistrationHolds } from "@/lib/purge-registration-holds";
import { prisma } from "@/lib/prisma";
import { getRegistrationHoldPendingId, getSessionClientId } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { resolveClientSubscriptionBilling } from "@/lib/match-fit-launch-promotions";
import { estimateStripeProcessingFeeCents } from "@/lib/stripe-processing-fee";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  billingChoice: z.enum(["trial_3d", "pay_now"]).optional(),
  reactivation: z.boolean().optional(),
});

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return String(err);
}

function getAppOrigin(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return new URL(req.url).origin;
}

async function createClientSubscriptionCheckout(args: {
  req: Request;
  stripe: NonNullable<ReturnType<typeof getStripe>>;
  priceId: string;
  customerEmail: string;
  metadata: Record<string, string>;
  trialDays: number;
  successPath?: string;
}) {
  const origin = getAppOrigin(args.req);
  const monthlyCents = 1000;
  const processingCents =
    args.metadata.matchFitBillingChoice === "pay_now" ? estimateStripeProcessingFeeCents(monthlyCents) : 0;
  const successPath = args.successPath ?? "/client/subscribe/return?session_id={CHECKOUT_SESSION_ID}";

  const session = await args.stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: args.customerEmail,
    payment_method_collection: "if_required",
    line_items: [{ price: args.priceId, quantity: 1 }],
    success_url: `${origin}${successPath}`,
    cancel_url: `${origin}/client/dashboard/billing?canceled=1`,
    metadata: {
      ...args.metadata,
      ...(processingCents > 0 ? { estimatedFirstInvoiceProcessingCents: String(processingCents) } : {}),
    },
    subscription_data: {
      ...(args.trialDays > 0 ? { trial_period_days: args.trialDays } : {}),
      metadata: args.metadata,
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL. Check your Stripe account and price configuration." },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: session.url });
}

export async function POST(req: Request) {
  try {
    await purgeExpiredRegistrationHolds();

    const secretPresent = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
    const priceId = process.env.STRIPE_PRICE_ID?.trim();

    if (!secretPresent) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY is missing or empty. Add it to .env and restart the dev server." },
        { status: 503 },
      );
    }
    if (!priceId) {
      return NextResponse.json(
        { error: "STRIPE_PRICE_ID is missing or empty. Create a $10/month recurring Price in Stripe and paste its price_… id." },
        { status: 503 },
      );
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe client failed to initialize from STRIPE_SECRET_KEY (check the key format)." },
        { status: 503 },
      );
    }

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);

    const sessionClientId = await getSessionClientId();
    if (sessionClientId) {
      const client = await prisma.client.findUnique({
        where: { id: sessionClientId },
        select: {
          email: true,
          accountDeactivatedAt: true,
          paymentGraceUntil: true,
          platformTrialEndsAt: true,
          stripeSubscriptionActive: true,
        },
      });
      if (!client) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      const needsPayment =
        Boolean(client.accountDeactivatedAt) ||
        (client.paymentGraceUntil && client.paymentGraceUntil.getTime() > Date.now()) ||
        (client.platformTrialEndsAt && client.platformTrialEndsAt.getTime() <= Date.now() && !client.stripeSubscriptionActive);
      if (needsPayment || parsed.success && parsed.data.reactivation) {
        return createClientSubscriptionCheckout({
          req,
          stripe,
          priceId,
          customerEmail: client.email,
          metadata: {
            clientId: sessionClientId,
            matchFitBillingChoice: "reactivation_pay_now",
          },
          trialDays: 0,
          successPath: "/client/subscribe/return?session_id={CHECKOUT_SESSION_ID}",
        });
      }
    }

    const holdId = await getRegistrationHoldPendingId();
    if (!holdId) {
      return NextResponse.json({ error: "No registration in progress. Start sign-up again." }, { status: 401 });
    }

    const hold = await prisma.pendingClientRegistration.findUnique({
      where: { id: holdId },
    });

    if (!hold || hold.expiresAt < new Date()) {
      await prisma.pendingClientRegistration.deleteMany({ where: { id: holdId } });
      return NextResponse.json({ error: "Your registration session expired. Please start again." }, { status: 410 });
    }

    if (hold.status !== "AWAITING_PAYMENT") {
      return NextResponse.json({ error: "This account is not ready for billing." }, { status: 400 });
    }

    const billingChoice = parsed.success ? parsed.data.billingChoice : undefined;
    const billing = await resolveClientSubscriptionBilling({ billingChoice });
    if (!billing.foundingSlot && !billingChoice) {
      return NextResponse.json(
        {
          error:
            "Choose a membership option for this pending registration: legacy Stripe trial with card on file, or pay now.",
          code: "BILLING_CHOICE_REQUIRED",
        },
        { status: 400 },
      );
    }

    const subscriptionMetadata: Record<string, string> = {
      holdId: hold.id,
      matchFitBillingChoice: billing.choice,
      ...(billing.foundingSlot ? { matchFitFoundingTrial: "1" } : {}),
    };

    try {
      return await createClientSubscriptionCheckout({
        req,
        stripe,
        priceId,
        customerEmail: hold.email,
        metadata: subscriptionMetadata,
        trialDays: billing.trialDays,
        successPath: "/client/subscribe/return?session_id={CHECKOUT_SESSION_ID}&legacy=1",
      });
    } catch (e) {
      console.error("[create-subscription] Stripe Checkout error:", e);
      return NextResponse.json({ error: `Stripe error: ${errorMessage(e)}` }, { status: 502 });
    }
  } catch (e) {
    console.error("[create-subscription] Unexpected error:", e);
    return NextResponse.json({ error: `Checkout failed: ${errorMessage(e)}` }, { status: 500 });
  }
}
