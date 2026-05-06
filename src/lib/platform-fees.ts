/** Match Fit administrative fee on non-subscription purchases (Terms §3). */
export const PLATFORM_ADMIN_FEE_RATE = 0.2;

export const ADMIN_FEE_UI_LABEL = "Administrative fee (20%) — non-refundable";

/** Stripe line-item description for the admin portion. */
export const ADMIN_FEE_STRIPE_DESCRIPTION =
  "Match Fit administrative fee (20%). Non-refundable if the underlying service is cancelled or marked as a no-show.";

export function adminFeeCentsFromBaseSubtotalCents(baseCents: number): number {
  if (!Number.isFinite(baseCents) || baseCents <= 0) return 0;
  return Math.round(baseCents * PLATFORM_ADMIN_FEE_RATE);
}
