import { NextResponse } from "next/server";
import { connectAccountRequestOptions } from "@/lib/stripe-connect/account-status";
import { getStripeConnectClient } from "@/lib/stripe-connect/client";
import { stripeConnectApiError } from "@/lib/stripe-connect/api-error";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ accountId: string }> };

/**
 * List active products on the connected account (Stripe-Account header).
 */
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { accountId } = await ctx.params;
    const stripeClient = getStripeConnectClient();
    const opts = connectAccountRequestOptions(accountId);

    const products = await stripeClient.products.list(
      { limit: 20, active: true, expand: ["data.default_price"] },
      opts,
    );

    const items = products.data.map((p) => {
      const price = p.default_price;
      const unitAmount =
        price && typeof price === "object" && "unit_amount" in price ? price.unit_amount : null;
      const currency =
        price && typeof price === "object" && "currency" in price ? price.currency : "usd";
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        unitAmount,
        currency,
      };
    });

    return NextResponse.json({ products: items });
  } catch (e) {
    console.error("[stripe-connect-demo] list products", e);
    return stripeConnectApiError(e, "Could not list products.");
  }
}

/**
 * Create a product + default price on the connected account.
 */
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { accountId } = await ctx.params;
    const body = (await req.json()) as {
      name?: string;
      description?: string;
      priceInCents?: number;
      currency?: string;
    };

    const name = body.name?.trim();
    const description = body.description?.trim() || undefined;
    const priceInCents = body.priceInCents;
    const currency = (body.currency?.trim() || "usd").toLowerCase();

    if (!name || priceInCents == null || !Number.isFinite(priceInCents) || priceInCents < 50) {
      return NextResponse.json(
        { error: "name and priceInCents (≥ 50) are required." },
        { status: 400 },
      );
    }

    const stripeClient = getStripeConnectClient();
    const opts = connectAccountRequestOptions(accountId);

    const product = await stripeClient.products.create(
      {
        name,
        description,
        default_price_data: {
          unit_amount: Math.round(priceInCents),
          currency,
        },
      },
      opts,
    );

    return NextResponse.json({ productId: product.id });
  } catch (e) {
    console.error("[stripe-connect-demo] create product", e);
    return stripeConnectApiError(e, "Could not create product.");
  }
}
