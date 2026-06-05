/**
 * Estimated platform valuation for the admin dashboard (beta-stage heuristic).
 *
 * Blends annualized subscription ARR, annualized 30d gross profit, a success-rating-scaled
 * marketplace multiple, and a conservative per-active-member network value.
 */

export type PlatformValuationInput = {
  activePlatformSubscribers: number;
  activeTrainerPremiumSubscribers: number;
  grossProfit30dCents: number;
  activeUsers: number;
  successScore: number;
};

export type PlatformValuationBreakdown = {
  valuationCents: number;
  subscriptionArrCents: number;
  transactionalArrCents: number;
  totalArrCents: number;
  revenueMultiple: number;
  networkValueCents: number;
  method: string;
};

const CLIENT_PLATFORM_MRR_CENTS = 1000;
const TRAINER_PREMIUM_MRR_CENTS = 2000;
const NETWORK_VALUE_PER_ACTIVE_USER_CENTS = 2500;
const MIN_MULTIPLE = 3;
const MAX_MULTIPLE = 8;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function computePlatformValuation(input: PlatformValuationInput): PlatformValuationBreakdown {
  const subscriptionArrCents =
    (input.activePlatformSubscribers * CLIENT_PLATFORM_MRR_CENTS +
      input.activeTrainerPremiumSubscribers * TRAINER_PREMIUM_MRR_CENTS) *
    12;
  const transactionalArrCents = Math.max(0, input.grossProfit30dCents) * 12;
  const totalArrCents = subscriptionArrCents + transactionalArrCents;
  const revenueMultiple = MIN_MULTIPLE + clamp01(input.successScore / 10) * (MAX_MULTIPLE - MIN_MULTIPLE);
  const networkValueCents = Math.max(0, input.activeUsers) * NETWORK_VALUE_PER_ACTIVE_USER_CENTS;
  const valuationCents = Math.round(totalArrCents * revenueMultiple + networkValueCents);

  return {
    valuationCents,
    subscriptionArrCents,
    transactionalArrCents,
    totalArrCents,
    revenueMultiple: Math.round(revenueMultiple * 10) / 10,
    networkValueCents,
    method: "Beta marketplace heuristic: ARR × success-scaled multiple + active-member network value",
  };
}
