import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  applyFoundingSalesBonusToLedger,
  computeFoundingSalesBonusCents,
  foundingTrainerSignupRankForNewTrainer,
  isFoundingTrainerRankEligible,
} from "@/lib/founding-trainer-sales-bonus";
import {
  getFoundingTrainerSalesBonusMaxTrainers,
  isFoundingTrainerBySignupRank,
  isFoundingTrainerSalesBonusEligibleDate,
} from "@/lib/match-fit-launch-promotions";

describe("founding-trainer-sales-bonus", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.MATCH_FIT_FOUNDING_TRAINER_SALES_BONUS_MAX_TRAINERS;
    delete process.env.MATCH_FIT_FOUNDING_TRAINER_SALES_BONUS_PERCENT;
    delete process.env.MATCH_FIT_FOUNDING_TRAINER_SALES_BONUS_ENDS_DATE;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("computes 5% of gross checkout by default", () => {
    expect(
      computeFoundingSalesBonusCents({
        amountCents: 10_000,
        adminFeeCents: 2_000,
        totalChargedCents: 12_000,
      }),
    ).toBe(600);
    expect(computeFoundingSalesBonusCents({ amountCents: 0, adminFeeCents: 0 })).toBe(0);
  });

  it("assigns signup rank for first 30 trainers", () => {
    expect(foundingTrainerSignupRankForNewTrainer(0)).toBe(1);
    expect(foundingTrainerSignupRankForNewTrainer(29)).toBe(30);
    expect(foundingTrainerSignupRankForNewTrainer(30)).toBeNull();
    expect(isFoundingTrainerBySignupRank(29)).toBe(true);
    expect(isFoundingTrainerBySignupRank(30)).toBe(false);
  });

  it("validates signup rank eligibility", () => {
    expect(isFoundingTrainerRankEligible(1)).toBe(true);
    expect(isFoundingTrainerRankEligible(getFoundingTrainerSalesBonusMaxTrainers())).toBe(true);
    expect(isFoundingTrainerRankEligible(getFoundingTrainerSalesBonusMaxTrainers() + 1)).toBe(false);
    expect(isFoundingTrainerRankEligible(null)).toBe(false);
  });

  it("applies bonus to ledger service pool and per-unit rate", () => {
    const updated = applyFoundingSalesBonusToLedger(
      {
        payoutModel: "SERVICE_UNIT",
        ledgerGrossTotalCents: 12_000,
        ledgerStripeFeeEstimateCents: 400,
        ledgerNetAfterFeesCents: 9_000,
        ledgerNetServicePoolCents: 9_000,
        ledgerNetAddonPoolCents: 0,
        ledgerTotalServiceUnits: 5,
        ledgerTotalAddonUnits: 0,
        ledgerPerServiceUnitNetCents: 1800,
        ledgerPerAddonUnitNetCents: 0,
      },
      500,
    );
    expect(updated.ledgerNetAfterFeesCents).toBe(9500);
    expect(updated.ledgerNetServicePoolCents).toBe(9500);
    expect(updated.ledgerPerServiceUnitNetCents).toBe(1900);
  });

  it("limits promo to calendar year 2026 in America/New_York", () => {
    expect(isFoundingTrainerSalesBonusEligibleDate(new Date("2026-12-31T23:59:00-05:00"))).toBe(true);
    expect(isFoundingTrainerSalesBonusEligibleDate(new Date("2027-01-01T00:00:00-05:00"))).toBe(false);
  });
});
