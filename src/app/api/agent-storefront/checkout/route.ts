import { NextResponse } from "next/server";
import { createMatchFitAgentGuestCheckout } from "@/lib/agent-storefront/guest-checkout";

/**
 * MF-AGENT-GUEST-CHECKOUT-0925 pilot endpoint. Lets an AI agent start a guest
 * checkout for a coach booking with no Match Fit account required up front —
 * new route, does not touch any existing auth/checkout/webhook route.
 *
 * POST { trainerId, checkoutKey, buyerEmail?, tool?, params? }
 *
 * SECURITY: no `amountCents` field. The caller names which of the trainer's
 * published services it wants (`checkoutKey`, from that trainer's own public
 * SKU list); the price is always looked up server-side from the trainer's
 * published catalog. A caller cannot set or influence the charge amount.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "invalid_input", message: "Invalid JSON body." }, { status: 400 });
  }

  const trainerId = typeof body.trainerId === "string" ? body.trainerId : "";
  const checkoutKey = typeof body.checkoutKey === "string" ? body.checkoutKey : "";
  const buyerEmail = typeof body.buyerEmail === "string" ? body.buyerEmail : undefined;
  const tool = typeof body.tool === "string" ? body.tool : "mf_book_session";
  const params =
    body.params && typeof body.params === "object" ? (body.params as Record<string, unknown>) : undefined;

  const result = await createMatchFitAgentGuestCheckout({
    tool,
    trainerId,
    checkoutKey,
    buyerEmail,
    params,
  });

  const httpStatus = result.status === "awaiting_payment" ? 200 : result.status === "invalid_input" ? 400 : 503;
  return NextResponse.json(result, { status: httpStatus });
}
