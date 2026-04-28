import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
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
      select: { stripeSubscriptionId: true },
    });
    if (!client?.stripeSubscriptionId) {
      return NextResponse.json({ error: "No active subscription to cancel." }, { status: 400 });
    }

    await stripe.subscriptions.update(client.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    return NextResponse.json({ ok: true, message: "Your subscription will end after the current billing period." });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not cancel subscription." }, { status: 500 });
  }
}
