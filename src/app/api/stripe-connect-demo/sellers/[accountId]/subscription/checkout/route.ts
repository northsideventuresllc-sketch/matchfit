import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { requireStripeConnectPlatformPriceId } from "@/lib/stripe-connect/config";
import { getStripeConnectClient } from "@/lib/stripe-connect/client";
import { stripeConnectApiError } from "@/lib/stripe-connect/api-error";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ accountId: string }> };

/**
 * Platform subscription billed to the connected account using V2 `customer_account`
 * (same id as the connected account — do not use legacy `.customer` for V2 accounts).
 */
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { accountId } = await ctx.params;
    const priceId = requireStripeConnectPlatformPriceId();
    const stripeClient = getStripeConnectClient();
    const origin = getAppOriginFromRequest(req);

    const session = await stripeClient.checkout.sessions.create({
      customer_account: accountId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/stripe-connect-demo/dashboard?accountId=${encodeURIComponent(accountId)}&subscription=success`,
      cancel_url: `${origin}/stripe-connect-demo/dashboard?accountId=${encodeURIComponent(accountId)}`,
      metadata: {
        connect_demo: "platform_subscription",
        connected_account_id: accountId,
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Checkout session missing URL." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe-connect-demo] subscription checkout", e);
    return stripeConnectApiError(e, "Could not start subscription checkout.");
  }
}
