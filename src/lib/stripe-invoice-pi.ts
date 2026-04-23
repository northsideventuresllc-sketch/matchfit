import type Stripe from "stripe";

/** Expanded `latest_invoice.payment_intent` is not on default Stripe `Invoice` typings. */
export function getInvoicePaymentIntent(
  inv: Stripe.Invoice | string | null | undefined,
): Stripe.PaymentIntent | string | null | undefined {
  if (!inv || typeof inv === "string") return undefined;
  return (inv as Stripe.Invoice & { payment_intent?: Stripe.PaymentIntent | string | null }).payment_intent;
}
