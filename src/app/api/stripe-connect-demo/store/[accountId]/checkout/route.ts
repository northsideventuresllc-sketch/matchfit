import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { connectAccountRequestOptions } from "@/lib/stripe-connect/account-status";
import {
  computeApplicationFeeCents,
  stripeConnectApplicationFeeBps,
} from "@/lib/stripe-connect/config";
import { getStripeConnectClient } from "@/lib/stripe-connect/client";
import { stripeConnectApiError } from "@/lib/stripe-connect/api-error";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ accountId: string }> };

/**
 * Direct charge on the connected account with a platform application fee (hosted Checkout).
 */
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { accountId } = await ctx.params;
    const body = (await req.json()) as {
      productId?: string;
      quantity?: number;
    };

    const productId = body.productId?.trim();
    const quantity = Math.max(1, Math.min(99, Math.floor(body.quantity ?? 1)));

    if (!productId) {
      return NextResponse.json({ error: "productId is required." }, { status: 400 });
    }

    const stripeClient = getStripeConnectClient();
    const opts = connectAccountRequestOptions(accountId);
    const origin = getAppOriginFromRequest(req);

    const product = await stripeClient.products.retrieve(productId, { expand: ["default_price"] }, opts);
    const price = product.default_price;
    if (!price || typeof price !== "object" || !("id" in price)) {
      return NextResponse.json({ error: "Product has no default price." }, { status: 400 });
    }

    const unitAmount = price.unit_amount ?? 0;
    const applicationFeeAmount = computeApplicationFeeCents(unitAmount * quantity);

    const session = await stripeClient.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{ price: price.id, quantity }],
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
        },
        success_url: `${origin}/stripe-connect-demo/success?session_id={CHECKOUT_SESSION_ID}&accountId=${encodeURIComponent(accountId)}`,
        cancel_url: `${origin}/stripe-connect-demo/store/${encodeURIComponent(accountId)}`,
        metadata: {
          connect_demo: "storefront",
          connected_account_id: accountId,
          application_fee_bps: String(stripeConnectApplicationFeeBps()),
        },
      },
      opts,
    );

    if (!session.url) {
      return NextResponse.json({ error: "Checkout session missing URL." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe-connect-demo] storefront checkout", e);
    return stripeConnectApiError(e, "Could not start checkout.");
  }
}
