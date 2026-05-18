import type { BillingUnit } from "@/lib/trainer-match-questionnaire";
import { serviceOfferingIsDiyTemplate, type MatchServiceId } from "@/lib/trainer-match-questionnaire";

function defaultSessionEndForHourly(start: Date, end: Date | null): Date {
  if (end && end.getTime() > start.getTime()) return end;
  const d = new Date(start);
  d.setHours(d.getHours() + 1);
  return d;
}

import { estimateStripeProcessingFeeCents } from "@/lib/stripe-processing-fee";

export { estimateStripeProcessingFeeCents };

export type PayoutModel = "SERVICE_UNIT" | "TIME_UNIT" | "CYCLE_DIY";

export type CheckoutLedgerSplits = {
  payoutModel: PayoutModel;
  ledgerGrossTotalCents: number;
  ledgerStripeFeeEstimateCents: number;
  ledgerNetAfterFeesCents: number;
  ledgerNetServicePoolCents: number;
  ledgerNetAddonPoolCents: number;
  ledgerTotalServiceUnits: number;
  ledgerTotalAddonUnits: number;
  ledgerPerServiceUnitNetCents: number;
  ledgerPerAddonUnitNetCents: number;
};

export function resolvePayoutModel(args: {
  billingUnit: string | null | undefined;
  bookingUnlimitedPurchase: boolean;
  serviceId: string | null | undefined;
}): PayoutModel {
  const sid = (args.serviceId ?? "").trim() as MatchServiceId;
  if (
    args.bookingUnlimitedPurchase &&
    (serviceOfferingIsDiyTemplate(sid) || billingUnitIsCadence(args.billingUnit))
  ) {
    return "CYCLE_DIY";
  }
  if (args.billingUnit === "per_hour") return "TIME_UNIT";
  return "SERVICE_UNIT";
}

function billingUnitIsCadence(u: string | null | undefined): boolean {
  return u === "per_month" || u === "per_week" || u === "twice_weekly";
}

/**
 * Marketplace ledger (per checkout):
 *
 * 1) **Gross card charge** `ledgerGrossTotalCents` = `totalChargedCents` when provided, else coach subtotal + admin line.
 * 2) **Non-refundable first cut:** subtract `adminFeeCents` (Match Fit administrative line, typically 20% of coach subtotal)
 *    plus **estimated** card processing (`estimateStripeProcessingFeeCents` on gross) to get `ledgerNetAfterFeesCents`.
 * 3) **Service vs add-on pools:** the coach-facing subtotal (`coachSubtotalCents`) is split into gross service vs gross add-on
 *    (`grossAddonAttributedCents`). Each pool receives the same *proportion* of `ledgerNetAfterFeesCents` so that
 *    `ledgerNetServicePoolCents + ledgerNetAddonPoolCents === ledgerNetAfterFeesCents` (remainder stays on the service line).
 * 4) **Per-unit trainer accrual rates (net, after fees):**
 *    - **Per session / multi-session:** `ledgerPerServiceUnitNetCents = floor(ledgerNetServicePoolCents / sessionCreditsGranted)`.
 *    - **Per hour (main package):** denominators use **purchased hour credits** (`sessionCreditsGranted` = total hours in the package).
 *    - **Add-ons:** `ledgerPerAddonUnitNetCents = floor(ledgerNetAddonPoolCents / ledgerTotalAddonUnits)` where addon units
 *      default to purchased session credits when add-on gross > 0; for **hourly add-on bundles** pass `addonHoursPurchased`
 *      so units = purchased add-on hours.
 * 5) **DIY / cadence (`CYCLE_DIY`):** service pool is treated as one cycle line; add-on pool still follows add-on rules.
 *
 * Trainer payout for a **completed** session/hour/add-on slice is then `perUnitNet × consumedUnits` at booking confirmation
 * (see `allocationNetCentsForSession`), subject to Gate A/B, dispute buffer, and payout operations.
 */
export function computeCheckoutLedgerSplits(args: {
  coachSubtotalCents: number;
  totalChargedCents: number | null | undefined;
  adminFeeCents: number | null | undefined;
  sessionCreditsGranted: number;
  billingUnit: string | null | undefined;
  bookingUnlimitedPurchase: boolean;
  serviceId: string | null | undefined;
  /** Optional cents of gross add-ons (post-discount style); deducted from coach line into add-on pool for split math. Defaults 0. */
  grossAddonAttributedCents?: number | null;
  /**
   * When the main purchase is **per_hour** and add-ons are sold as an hour bundle, set total purchased add-on hours so
   * `ledgerPerAddonUnitNetCents` divides the net add-on pool by hours instead of session credits.
   */
  addonHoursPurchased?: number | null;
}): CheckoutLedgerSplits {
  const coach = Math.max(0, Math.floor(args.coachSubtotalCents));
  const admin = Math.max(0, Math.floor(args.adminFeeCents ?? 0));
  const gross =
    args.totalChargedCents != null && args.totalChargedCents > 0
      ? Math.floor(args.totalChargedCents)
      : coach + admin;

  const stripeFees = estimateStripeProcessingFeeCents(gross);
  const netAfter = Math.max(0, gross - admin - stripeFees);

  const addonGrossAttributed = Math.max(0, Math.min(coach, Math.floor(args.grossAddonAttributedCents ?? 0)));
  const coachNetPortionOfLedger = coach === 0 ? 0 : Math.floor((netAfter * (coach - addonGrossAttributed)) / Math.max(coach, 1));
  const addonPortionFromCoach = coach === 0 ? 0 : Math.floor((netAfter * addonGrossAttributed) / Math.max(coach, 1));
  let netService = coachNetPortionOfLedger;
  const netAddon = addonPortionFromCoach;
  const splitSum = netService + netAddon;
  if (splitSum !== netAfter && netAfter > 0) {
    netService += netAfter - splitSum;
  }

  const payoutModel = resolvePayoutModel(args);
  const credits = Math.max(1, Math.floor(Math.max(0, args.sessionCreditsGranted)));
  const addonHoursRaw = Math.max(0, Number(args.addonHoursPurchased ?? 0));
  const addonHoursFloored = Number.isFinite(addonHoursRaw) ? Math.floor(addonHoursRaw) : 0;
  /// For hourly / session packages, denomination is “purchased units” used as pool denominator.
  let ledgerTotalAddonUnits =
    payoutModel === "CYCLE_DIY" ? 1 : addonGrossAttributed > 0 ? Math.max(1, credits) : 0;
  if (payoutModel === "TIME_UNIT" && addonGrossAttributed > 0 && addonHoursFloored > 0) {
    ledgerTotalAddonUnits = Math.max(1, addonHoursFloored);
  }

  const ledgerTotalServiceUnits = payoutModel === "TIME_UNIT" ? credits : payoutModel === "CYCLE_DIY" ? 1 : credits;

  const perSvc = payoutModel === "CYCLE_DIY" ? netService : Math.floor(netService / Math.max(1, ledgerTotalServiceUnits));

  let perAddon = 0;
  if (netAddon > 0 && ledgerTotalAddonUnits > 0) {
    perAddon = Math.floor(netAddon / ledgerTotalAddonUnits);
  }

  return {
    payoutModel,
    ledgerGrossTotalCents: gross,
    ledgerStripeFeeEstimateCents: stripeFees,
    ledgerNetAfterFeesCents: netAfter,
    ledgerNetServicePoolCents: netService,
    ledgerNetAddonPoolCents: netAddon,
    ledgerTotalServiceUnits,
    ledgerTotalAddonUnits,
    ledgerPerServiceUnitNetCents: perSvc,
    ledgerPerAddonUnitNetCents: perAddon,
  };
}

/** Billable hourly units derived from booked window (minimum 15 minutes). */
export function sessionConsumedBillingUnits(start: Date, end: Date | null, billingUnit: BillingUnit): number {
  if (billingUnit !== "per_hour") return 1;
  const e = defaultSessionEndForHourly(start, end);
  const msRaw = Math.max(0, e.getTime() - start.getTime());
  const fifteen = 15 * 60 * 1000;
  const ms = Math.max(msRaw, fifteen);
  const hours = ms / (60 * 60 * 1000);
  const quarterHours = Math.ceil(hours / 0.25);
  return Math.max(0.25, quarterHours * 0.25);
}

export function allocationNetCentsForSession(args: {
  ledgerPerServiceUnitNetCents: number | null;
  ledgerPerAddonUnitNetCents: number | null;
  /** Fallback gross coach÷credits when ledger row not backfilled yet. */
  fallbackCoachPoolCents: number;
  fallbackCredits: number;
  consumedServiceUnits: number;
  addonUnitsAttributed: number;
}): { netService: number; netAddon: number } {
  const perSvc =
    args.ledgerPerServiceUnitNetCents != null && args.ledgerPerServiceUnitNetCents >= 0
      ? args.ledgerPerServiceUnitNetCents
      : Math.floor(Math.max(0, args.fallbackCoachPoolCents) / Math.max(1, Math.floor(args.fallbackCredits)));

  const perAddon =
    args.ledgerPerAddonUnitNetCents != null && args.ledgerPerAddonUnitNetCents >= 0
      ? args.ledgerPerAddonUnitNetCents
      : 0;

  const netService = Math.max(0, Math.floor(perSvc * args.consumedServiceUnits));
  const netAddon = Math.max(
    0,
    Math.floor(perAddon * Math.max(0, args.addonUnitsAttributed)),
  );
  return { netService, netAddon };
}
