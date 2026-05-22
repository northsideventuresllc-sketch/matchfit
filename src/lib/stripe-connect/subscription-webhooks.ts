import type Stripe from "stripe";
import { updateConnectDemoSellerSubscription } from "./sellers-db";

/** Event types processed by {@link handleConnectSubscriptionWebhookEvent}. */
export const CONNECT_SUBSCRIPTION_HANDLED_WEBHOOK_TYPES = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
] as const;

const HANDLED_TYPE_SET = new Set<string>(CONNECT_SUBSCRIPTION_HANDLED_WEBHOOK_TYPES);

export function isConnectSubscriptionHandledWebhookType(eventType: string): boolean {
  return HANDLED_TYPE_SET.has(eventType);
}

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
        null;

      if (!accountId?.startsWith("acct_")) {
        console.warn(
          "[stripe-connect-demo] subscription webhook missing customer_account (V2 connected account)",
          { subscriptionId: sub.id, customerAccount: accountId },
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
        null;

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
        null;

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
