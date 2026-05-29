import {
  getTrainerFoundingBgPercentMax,
  type TrainerRegistrationPricingMode,
} from "@/lib/match-fit-launch-promotions";

/** Platform registration list price (USD). Standard tier splits this between Checkr and Match Fit. */
export const TRAINER_PLATFORM_REGISTRATION_FEE_CENTS = 10_000;

export function formatTrainerRegistrationUsd(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

export type StandardTrainerRegistrationBreakdown = {
  totalCents: number;
  backgroundCheckCents: number;
  platformCents: number;
};

/** Standard tier: $100.00 total = background check fee + Match Fit platform fee. */
export function computeStandardTrainerRegistrationBreakdown(
  backgroundCheckCents: number,
): StandardTrainerRegistrationBreakdown {
  const bg = Math.max(0, Math.floor(backgroundCheckCents));
  const totalCents = TRAINER_PLATFORM_REGISTRATION_FEE_CENTS;
  const platformCents = Math.max(0, totalCents - bg);
  return { totalCents, backgroundCheckCents: bg, platformCents };
}

/** Copy helper for standard (non-founding) trainer onboarding fee disclosure. */
export function describeStandardTrainerRegistrationBreakdown(backgroundCheckCents: number): string {
  const { totalCents, backgroundCheckCents: bg, platformCents } =
    computeStandardTrainerRegistrationBreakdown(backgroundCheckCents);
  return `${formatTrainerRegistrationUsd(bg)} background check + ${formatTrainerRegistrationUsd(platformCents)} Match Fit platform sign-up fee = ${formatTrainerRegistrationUsd(totalCents)} total (USD)`;
}

export function trainerRegistrationPricingModeForNewTrainer(
  trainerCountBeforeInsert: number,
): TrainerRegistrationPricingMode {
  return trainerCountBeforeInsert < getTrainerFoundingBgPercentMax()
    ? "FOUNDING_BG_SURCHARGE_20PCT"
    : "STANDARD_100_MINUS_BG";
}

/**
 * Amount due to Match Fit at registration checkout (cents), excluding processing fee line.
 * - Founding: 20% of verified Checkr/vendor background amount.
 * - Standard: $100 total minus amount paid to Checkr for the platform portion (floored at 0).
 */
export function computeTrainerRegistrationDueCents(args: {
  pricingMode: TrainerRegistrationPricingMode;
  backgroundCheckVendorPaidCents: number;
}): { dueCents: number; error?: string } {
  const bg = Math.max(0, Math.floor(args.backgroundCheckVendorPaidCents));
  if (bg <= 0) {
    return { dueCents: 0, error: "Background check payment amount is not recorded yet." };
  }
  if (args.pricingMode === "FOUNDING_BG_SURCHARGE_20PCT") {
    const due = Math.max(1, Math.round(bg * 0.2));
    return { dueCents: due };
  }
  const due = Math.max(0, TRAINER_PLATFORM_REGISTRATION_FEE_CENTS - bg);
  if (due <= 0) {
    return {
      dueCents: 0,
      error: "No platform registration balance is due after your background check fee.",
    };
  }
  return { dueCents: due };
}
