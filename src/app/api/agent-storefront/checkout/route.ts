import { NextResponse } from "next/server";
import { createMatchFitAgentGuestCheckout } from "@/lib/agent-storefront/guest-checkout";

/**
 * MF-AGENT-GUEST-CHECKOUT-0925 pilot endpoint. Lets an AI agent start a guest
 * checkout for a coach booking with no Match Fit account required up front —
 * new route, does not touch any existing auth/checkout/webhook route.
 *
 * POST { trainerId, serviceName, amountCents, buyerEmail?, tool? }
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "invalid_input", message: "Invalid JSON body." }, { status: 400 });
  }

  const trainerId = typeof body.trainerId === "string" ? body.trainerId : "";
  const serviceName = typeof body.serviceName === "string" ? body.serviceName : "";
  const amountCents = typeof body.amountCents === "number" ? body.amountCents : 0;
  const buyerEmail = typeof body.buyerEmail === "string" ? body.buyerEmail : undefined;
  const tool = typeof body.tool === "string" ? body.tool : "mf_book_session";

  const result = await createMatchFitAgentGuestCheckout({
    tool,
    trainerId,
    serviceName,
    amountCents,
    buyerEmail,
  });

  const httpStatus = result.status === "awaiting_payment" ? 200 : result.status === "invalid_input" ? 400 : 503;
  return NextResponse.json(result, { status: httpStatus });
}
