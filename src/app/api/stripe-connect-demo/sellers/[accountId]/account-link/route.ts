import { NextResponse } from "next/server";
import { getAppOriginFromRequest } from "@/lib/app-origin";
import { getStripeConnectClient } from "@/lib/stripe-connect/client";
import { stripeConnectApiError } from "@/lib/stripe-connect/api-error";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ accountId: string }> };

/**
 * Step 3 — Stripe-hosted onboarding via V2 Account Links.
 */
export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { accountId } = await ctx.params;
    if (!accountId?.startsWith("acct_")) {
      return NextResponse.json({ error: "Invalid connected account id." }, { status: 400 });
    }

    const origin = getAppOriginFromRequest(req);
    const stripeClient = getStripeConnectClient();

    const accountLink = await stripeClient.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["merchant", "customer"],
          refresh_url: `${origin}/stripe-connect-demo/dashboard?accountId=${encodeURIComponent(accountId)}`,
          return_url: `${origin}/stripe-connect-demo/dashboard?accountId=${encodeURIComponent(accountId)}`,
        },
      },
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (e) {
    console.error("[stripe-connect-demo] account link", e);
    return stripeConnectApiError(e, "Could not create account link.");
  }
}
