import { prisma } from "@/lib/prisma";
import { getSessionClientId } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { NextResponse } from "next/server";

function getAppOrigin(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return new URL(req.url).origin;
}

export async function POST(req: Request) {
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
      select: { stripeCustomerId: true },
    });
    if (!client?.stripeCustomerId) {
      return NextResponse.json({ error: "No billing account on file yet." }, { status: 400 });
    }

    const origin = getAppOrigin(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: client.stripeCustomerId,
      return_url: `${origin}/client/dashboard/billing`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a portal URL." }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not open billing portal." }, { status: 500 });
  }
}
