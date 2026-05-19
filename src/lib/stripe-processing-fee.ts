/**
 * Estimated Stripe card processing (2.9% + $0.30) on a charge amount in cents.
 * Used at checkout (optional line item) and in ledger splits after purchase.
 */
export function estimateStripeProcessingFeeCents(chargeCents: number): number {
  if (!Number.isFinite(chargeCents) || chargeCents <= 0) return 0;
  return Math.round(chargeCents * 0.029 + 30);
}
