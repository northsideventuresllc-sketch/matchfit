import { NextResponse } from "next/server";
import { getStripeConnectClient } from "@/lib/stripe-connect/client";
import { stripeConnectApiError } from "@/lib/stripe-connect/api-error";
import { upsertConnectDemoSeller } from "@/lib/stripe-connect/sellers-db";

export const dynamic = "force-dynamic";

/**
 * Step 1 — Create a V2 connected account (no top-level `type: express|standard|custom`).
 * Stores `display_name` + `contact_email` mapping in Postgres for this demo.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { displayName?: string; contactEmail?: string };
    const displayName = body.displayName?.trim();
    const contactEmail = body.contactEmail?.trim().toLowerCase();

    if (!displayName || !contactEmail) {
      return NextResponse.json({ error: "displayName and contactEmail are required." }, { status: 400 });
    }

    const stripeClient = getStripeConnectClient();

    const account = await stripeClient.v2.core.accounts.create({
      display_name: displayName,
      contact_email: contactEmail,
      identity: { country: "us" },
      dashboard: "full",
      defaults: {
        responsibilities: {
          fees_collector: "stripe",
          losses_collector: "stripe",
        },
      },
      configuration: {
        customer: {},
        merchant: {
          capabilities: {
            card_payments: { requested: true },
          },
        },
      },
    });

    await upsertConnectDemoSeller({
      displayName,
      contactEmail,
      stripeAccountId: account.id,
    });

    return NextResponse.json({
      accountId: account.id,
      dashboardUrl: `/stripe-connect-demo/dashboard?accountId=${encodeURIComponent(account.id)}`,
      storefrontUrl: `/stripe-connect-demo/store/${encodeURIComponent(account.id)}`,
    });
  } catch (e) {
    console.error("[stripe-connect-demo] create account", e);
    return stripeConnectApiError(e, "Could not create connected account.");
  }
}
