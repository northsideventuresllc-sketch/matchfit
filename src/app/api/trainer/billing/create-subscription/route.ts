import { prisma } from "@/lib/prisma";
import { getSessionTrainerId } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { syncTrainerPlatformBillingLifecycle } from "@/lib/trainer-platform-lifecycle";
import { TRAINER_PLATFORM_SUBSCRIPTION_USD } from "@/lib/trainer-platform-trial-constants";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  reactivation: z.boolean().optional(),
});

function getAppOrigin(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return new URL(req.url).origin;
}

/**
 * Creates Stripe Checkout for the Independent Pro $15/mo subscription
 * (post-trial keep-account-active billing). Early subscribe during trial is allowed.
 */
export async function POST(req: Request) {
  try {
    const trainerId = await getSessionTrainerId();
    if (!trainerId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const secretPresent = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
    const priceId =
      process.env.STRIPE_TRAINER_PREMIUM_PRICE_ID?.trim() ||
      process.env.MATCH_FIT_TRAINER_PREMIUM_STRIPE_PRICE_ID?.trim();

    if (!secretPresent) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY is missing or empty. Add it to .env and restart the dev server." },
        { status: 503 },
      );
    }
    if (!priceId) {
      return NextResponse.json(
        {
          error: `STRIPE_TRAINER_PREMIUM_PRICE_ID is missing. Create a $${TRAINER_PLATFORM_SUBSCRIPTION_USD.toFixed(2)}/month recurring Price in Stripe and paste its price_… id.`,
        },
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

    // Accept optional reactivation flag for future clients; checkout is always allowed when not subscribed.
    void bodySchema.safeParse(await req.json().catch(() => ({})));

    await syncTrainerPlatformBillingLifecycle(trainerId);
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      select: {
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeSubscriptionActive: true,
      },
    });
    if (!trainer) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (trainer.stripeSubscriptionActive && trainer.stripeSubscriptionId?.trim()) {
      return NextResponse.json({ error: "You already have an active Independent Pro subscription." }, { status: 409 });
    }

    const origin = getAppOrigin(req);
    const metadata = {
      trainerId,
      purpose: "trainer_independent_pro_subscription",
      matchFitBillingChoice: "trainer_premium_pay_now",
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(trainer.stripeCustomerId
        ? { customer: trainer.stripeCustomerId }
        : { customer_email: trainer.email }),
      payment_method_collection: "always",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/trainer/dashboard/billing?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/trainer/dashboard/billing?canceled=1`,
      metadata,
      subscription_data: {
        metadata,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL. Check your Stripe account and price configuration." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[trainer create-subscription]", e);
    return NextResponse.json({ error: "Could not start subscription checkout." }, { status: 500 });
  }
}
