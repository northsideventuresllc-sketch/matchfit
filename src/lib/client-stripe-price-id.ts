/**
 * Resolves the Stripe Price id for Client VIP ($10/mo).
 * Prefer MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID; fall back to legacy STRIPE_PRICE_ID
 * when both point at the same product during migration.
 */
export function resolveClientVipStripePriceId(): string | null {
  const vip = process.env.MATCH_FIT_CLIENT_VIP_STRIPE_PRICE_ID?.trim();
  if (vip) return vip;
  const legacy = process.env.STRIPE_PRICE_ID?.trim();
  return legacy || null;
}
