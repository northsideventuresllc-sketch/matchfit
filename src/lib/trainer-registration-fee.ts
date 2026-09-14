import {
  getTrainerBetaDiscountPercent,
  getTrainerFoundingBgCoveredMax,
  type TrainerRegistrationPricingMode,
} from "@/lib/match-fit-launch-promotion-caps";

import { TRAINER_PLATFORM_REGISTRATION_FEE_CENTS } from "@/lib/trainer-platform-registration-fee";

export { TRAINER_PLATFORM_REGISTRATION_FEE_CENTS } from "@/lib/trainer-platform-registration-fee";

/**
 * Two onboarding bands (corrected 2026-09-14, JB direct — see `getTrainerFoundingBgCoveredMax`;
 * previously three bands split the founding cohort into a smaller first-10 BG-covered slice and
 * an 11-30 "discounted but pay your own background check" slice — that split is gone):
 *   1–30  founding cohort: background check fully covered by Match Fit
 *   31+   standard fee, and the same after beta ends
 *
 * `BETA_DISCOUNTED` remains a valid `TrainerRegistrationPricingMode` for already-existing rows
 * written under the old three-band logic (see `computeTrainerRegistrationDueCents` below and
 * `syncFoundingBgCoveredTrainerPricingModes` in `trainer-founding-bg-covered.ts`, which upgrades
 * them) — it is simply never assigned to a new sign-up anymore.
 *
 * `trainerCountBeforeInsert` is only used here at trainer creation (see
 * `trainer-register-service.ts`, inside the same Serializable transaction that inserts the row),
 * and the resulting mode is written once to `trainerProfile.registrationFeePricingMode`. Tier
 * switches later (`fp-tier-switching.ts` / switch-tier route) never recompute or overwrite this
 * field, so a trainer's onboarding-fee band correctly stays pinned to their original signup rank
 * even if they switch tiers — confirmed on 2026-08-07 audit, no gap here. (See the
 * `foundingTrainerSignupRank` TODO in `launch-account-counts.ts` for the separate, live-COUNT-based
 * founding-cohort check used for tier-selection billing, which is a different mechanism from this
 * onboarding-fee band.)
 */
export function trainerRegistrationPricingModeForNewTrainer(
  trainerCountBeforeInsert: number,
): TrainerRegistrationPricingMode {
  if (trainerCountBeforeInsert < getTrainerFoundingBgCoveredMax()) {
    return "FOUNDING_BG_COVERED";
  }
  return "STANDARD_100_MINUS_BG";
}

/**
 * Amount due to Match Fit at registration checkout (cents), excluding processing fee line.
 * - Founding: 20% of verified Checkr/vendor background amount.
 * - Standard: $100 minus amount paid to Checkr (floored at 0).
 */
export function computeTrainerRegistrationDueCents(args: {
  pricingMode: TrainerRegistrationPricingMode;
  backgroundCheckVendorPaidCents: number;
}): { dueCents: number; error?: string } {
  const bg = Math.max(0, Math.floor(args.backgroundCheckVendorPaidCents));
  if (bg <= 0) {
    return { dueCents: 0, error: "Background check payment amount is not recorded yet." };
  }
  if (args.pricingMode === "FOUNDING_BG_COVERED" || args.pricingMode === "FOUNDING_BG_SURCHARGE_20PCT") {
    const due = Math.max(1, Math.round(bg * 0.2));
    return { dueCents: due };
  }
  if (args.pricingMode === "BETA_DISCOUNTED") {
    // Discounted platform fee, but the Fitness Pro still pays for their own background check.
    const standard = Math.max(0, TRAINER_PLATFORM_REGISTRATION_FEE_CENTS - bg);
    const discounted = Math.round((standard * (100 - getTrainerBetaDiscountPercent())) / 100);
    if (discounted <= 0) {
      return { dueCents: 0, error: "No onboarding balance is due after your background check payment." };
    }
    return { dueCents: discounted };
  }
  const due = Math.max(0, TRAINER_PLATFORM_REGISTRATION_FEE_CENTS - bg);
  if (due <= 0) {
    return {
      dueCents: 0,
      error: "No onboarding balance is due after your background check payment.",
    };
  }
  return { dueCents: due };
}
