import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { NextResponse } from "next/server";

/** Ends an active Stripe trial immediately and bills the subscription. */
export async function POST() {
  const clientId = await getSessionClientId();
  if (!clientId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { stripeSubscriptionId: true, subscriptionTrialEndsAt: true },
  });
  if (!client?.stripeSubscriptionId) {
    return NextResponse.json({ error: "No active subscription." }, { status: 400 });
  }
  if (!client.subscriptionTrialEndsAt || client.subscriptionTrialEndsAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Your trial has already ended." }, { status: 400 });
  }

  await stripe.subscriptions.update(client.stripeSubscriptionId, { trial_end: "now" });

  await prisma.client.update({
    where: { id: clientId },
    data: { subscriptionTrialEndsAt: null },
  });

  return NextResponse.json({ ok: true, message: "Your subscription billing has started." });
}
