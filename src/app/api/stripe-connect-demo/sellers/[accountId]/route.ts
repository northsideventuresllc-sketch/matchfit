import { NextResponse } from "next/server";
import { fetchConnectAccountStatus } from "@/lib/stripe-connect/account-status";
import { stripeConnectApiError } from "@/lib/stripe-connect/api-error";
import { findConnectDemoSellerByAccountId } from "@/lib/stripe-connect/sellers-db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ accountId: string }> };

/**
 * Step 2 — Read onboarding status live from Stripe (not from our database).
 */
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { accountId } = await ctx.params;
    if (!accountId?.startsWith("acct_")) {
      return NextResponse.json({ error: "Invalid connected account id." }, { status: 400 });
    }

    const status = await fetchConnectAccountStatus(accountId);
    const seller = await findConnectDemoSellerByAccountId(accountId);

    return NextResponse.json({
      ...status,
      platformSubscriptionStatus: seller?.platformSubscriptionStatus ?? null,
      platformSubscriptionId: seller?.platformSubscriptionId ?? null,
    });
  } catch (e) {
    console.error("[stripe-connect-demo] account status", e);
    return stripeConnectApiError(e, "Could not load account status.");
  }
}
