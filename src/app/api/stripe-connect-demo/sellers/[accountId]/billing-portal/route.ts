import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { getStripeConnectClient } from "@/lib/stripe-connect/client";
import { stripeConnectApiError } from "@/lib/stripe-connect/api-error";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ accountId: string }> };

/** Billing portal for the connected account’s platform subscription (V2 `customer_account`). */
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { accountId } = await ctx.params;
    const stripeClient = getStripeConnectClient();
    const origin = getAppOriginFromRequest(req);

    const session = await stripeClient.billingPortal.sessions.create({
      customer_account: accountId,
      return_url: `${origin}/stripe-connect-demo/dashboard?accountId=${encodeURIComponent(accountId)}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe-connect-demo] billing portal", e);
    return stripeConnectApiError(e, "Could not open billing portal.");
  }
}
