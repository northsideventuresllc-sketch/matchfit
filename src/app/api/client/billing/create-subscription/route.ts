import { purgeExpiredRegistrationHolds } from "@/lib/purge-registration-holds";
import { prisma } from "@/lib/prisma";
import { getRegistrationHoldPendingId } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { NextResponse } from "next/server";

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

export async function POST(req: Request) {
  console.log("Stripe Key Loaded:", !!process.env.STRIPE_SECRET_KEY);

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
        { error: "STRIPE_PRICE_ID is missing or empty. Create a $5/month recurring Price in Stripe and paste its price_… id." },
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

    const origin = getAppOrigin(req);

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: hold.email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/client/subscribe/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/client/subscribe?canceled=1`,
        metadata: { holdId: hold.id },
        subscription_data: {
          metadata: { holdId: hold.id },
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
      console.error("[create-subscription] Stripe Checkout error:", e);
      return NextResponse.json({ error: `Stripe error: ${errorMessage(e)}` }, { status: 502 });
    }
  } catch (e) {
    console.error("[create-subscription] Unexpected error:", e);
    return NextResponse.json({ error: `Checkout failed: ${errorMessage(e)}` }, { status: 500 });
  }
}
