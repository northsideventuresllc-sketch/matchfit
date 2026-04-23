import { finalizeRegistrationAfterPayment } from "@/lib/billing-finalize";
import { prisma } from "@/lib/prisma";
import { clearRegistrationHoldCookie, setClientSession } from "@/lib/session";
import { getInvoicePaymentIntent } from "@/lib/stripe-invoice-pi";
import { getStripe } from "@/lib/stripe-server";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  subscriptionId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const { subscriptionId } = parsed.data;

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    }

    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice.payment_intent"],
    });
    if (sub.status !== "active" && sub.status !== "trialing") {
      const inv = sub.latest_invoice;
      let paid = false;
      const pi = getInvoicePaymentIntent(inv);
      if (pi && typeof pi !== "string" && pi.status === "succeeded") {
        paid = true;
      }
      if (!paid) {
        return NextResponse.json(
          { error: "Your card has been declined. Please try another payment method or contact your bank." },
          { status: 402 },
        );
      }
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
    console.error(e);
    return NextResponse.json({ error: "Could not activate your account." }, { status: 500 });
  }
}
