import { NextResponse } from "next/server";
import { getAgentGuestCheckoutClaim } from "@/lib/agent-storefront/guest-checkout";

/**
 * MF-AGENT-GUEST-CHECKOUT-0925 pilot endpoint. Read-only lookup of a guest
 * checkout's paid/buyer-email state, for claim-on-signup matching later.
 * New route, does not touch any existing auth/checkout/webhook route.
 *
 * GET ?orderId=cs_...
 */
export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get("orderId") ?? "";
  if (!orderId.trim()) {
    return NextResponse.json({ status: "invalid_input", message: "orderId is required." }, { status: 400 });
  }
  const claim = await getAgentGuestCheckoutClaim(orderId);
  if (!claim) {
    return NextResponse.json({ status: "unavailable", message: "Checkout is temporarily unavailable." }, { status: 503 });
  }
  return NextResponse.json({ status: "ok", ...claim });
}
