import type Stripe from "stripe";
import { updateConnectDemoSellerSubscription } from "./sellers-db";

/**
 * Snapshot subscription webhooks — persist status on our demo seller row.
 * For V2 connected accounts use `subscription.customer_account` (not `.customer`).
 */
export async function handleConnectSubscriptionWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const accountId =
        (sub as Stripe.Subscription & { customer_account?: string | null }).customer_account ??
        (typeof sub.customer === "string" ? sub.customer : null);

      if (!accountId?.startsWith("acct_")) {
        console.warn(
          "[stripe-connect-demo] subscription webhook without acct_ customer_account — TODO: map legacy customer id to account",
          { subscriptionId: sub.id },
        );
        return;
      }

      await updateConnectDemoSellerSubscription({
        stripeAccountId: accountId,
        subscriptionId: sub.id,
        status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
      });
      return;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const accountId =
        (invoice as Stripe.Invoice & { customer_account?: string | null }).customer_account ??
        (typeof invoice.customer === "string" ? invoice.customer : null);

      if (accountId?.startsWith("acct_")) {
        const subId = invoice.parent?.subscription_details?.subscription;
        await updateConnectDemoSellerSubscription({
          stripeAccountId: accountId,
          subscriptionId: typeof subId === "string" ? subId : null,
          status: "active",
        });
      }
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const accountId =
        (invoice as Stripe.Invoice & { customer_account?: string | null }).customer_account ??
        (typeof invoice.customer === "string" ? invoice.customer : null);

      if (accountId?.startsWith("acct_")) {
        const subId = invoice.parent?.subscription_details?.subscription;
        await updateConnectDemoSellerSubscription({
          stripeAccountId: accountId,
          subscriptionId: typeof subId === "string" ? subId : null,
          status: "past_due",
        });
      }
      return;
    }

    default:
      return;
  }
}
