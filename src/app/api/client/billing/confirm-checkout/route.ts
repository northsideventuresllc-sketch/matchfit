import { finalizeRegistrationAfterPayment } from "@/lib/billing-finalize";
import { prisma } from "@/lib/prisma";
import { clearRegistrationHoldCookie, getRegistrationHoldPendingId, setClientSession } from "@/lib/session";
import { getStripe } from "@/lib/stripe-server";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  sessionId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const { sessionId } = parsed.data;

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: `Payment not completed (status: ${session.payment_status ?? "unknown"}).` },
        { status: 400 },
      );
    }

    const metaHoldId = session.metadata?.holdId;
    const cookieHoldId = await getRegistrationHoldPendingId();
    if (!metaHoldId || typeof metaHoldId !== "string") {
      return NextResponse.json({ error: "This checkout session is missing registration metadata." }, { status: 400 });
    }
    if (!cookieHoldId || cookieHoldId !== metaHoldId) {
      return NextResponse.json(
        {
          error:
            "This checkout does not match your current sign-up in this browser. Open the payment link from the same device you used to register, or sign in if you already have an account.",
        },
        { status: 403 },
      );
    }

    const sub = session.subscription;
    const subscriptionId = typeof sub === "string" ? sub : sub?.id;
    if (!subscriptionId) {
      return NextResponse.json({ error: "No subscription on this checkout session." }, { status: 400 });
    }

    const result = await finalizeRegistrationAfterPayment(subscriptionId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await clearRegistrationHoldCookie();
    const created = await prisma.client.findUnique({
      where: { id: result.clientId },
      select: { stayLoggedIn: true },
    });
    await setClientSession(result.clientId, created?.stayLoggedIn ?? true);
    return NextResponse.json({ ok: true, clientId: result.clientId });
  } catch (e) {
    console.error("[confirm-checkout]", e);
    const message = e instanceof Error ? e.message : "Could not confirm checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
