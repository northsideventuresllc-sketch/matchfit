import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getClientFoundingTrialDays,
  getClientFoundingTrialMaxClients,
  getClientPostCapTrialDays,
  getFoundingTrainerSalesBonusMaxSales,
  getFoundingTrainerSalesBonusMaxTrainers,
  getFoundingTrainerSalesBonusPercent,
  getTrainerFoundingBgPercentMax,
  getTrainerFoundingRegistrationWaiverMax,
  isFoundingTrainerBySignupRank,
  isFoundingTrainerSalesBonusEligibleDate,
  isNextClientEligibleForFoundingTrial,
  isTrainerFoundingBgPercentTier,
} from "@/lib/match-fit-launch-promotions";
import {
  computeStandardTrainerRegistrationBreakdown,
  computeTrainerRegistrationDueCents,
  describeStandardTrainerRegistrationBreakdown,
  formatTrainerRegistrationUsd,
  TRAINER_PLATFORM_REGISTRATION_FEE_CENTS,
} from "@/lib/trainer-registration-fee";

describe("match-fit-launch-promotions", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_MAX_CLIENTS;
    delete process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_DAYS;
    delete process.env.MATCH_FIT_CLIENT_POST_CAP_TRIAL_DAYS;
    delete process.env.MATCH_FIT_TRAINER_FOUNDING_BG_PERCENT_MAX;
    delete process.env.MATCH_FIT_TRAINER_FOUNDING_REGISTRATION_WAIVER_MAX;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("uses defaults for client trial caps", () => {
    expect(getClientFoundingTrialMaxClients()).toBe(150);
    expect(getClientFoundingTrialDays()).toBe(14);
    expect(getClientPostCapTrialDays()).toBe(3);
    expect(isNextClientEligibleForFoundingTrial(0)).toBe(true);
    expect(isNextClientEligibleForFoundingTrial(149)).toBe(true);
    expect(isNextClientEligibleForFoundingTrial(150)).toBe(false);
  });

  it("respects MATCH_FIT_CLIENT_FOUNDING_TRIAL_MAX_CLIENTS", () => {
    process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_MAX_CLIENTS = "2";
    expect(getClientFoundingTrialMaxClients()).toBe(2);
    expect(isNextClientEligibleForFoundingTrial(1)).toBe(true);
    expect(isNextClientEligibleForFoundingTrial(2)).toBe(false);
  });

  it("caps founding trial days", () => {
    process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_DAYS = "9999";
    expect(getClientFoundingTrialDays()).toBe(730);
  });

  it("uses defaults for trainer founding BG tier", () => {
    expect(getTrainerFoundingBgPercentMax()).toBe(30);
    expect(getTrainerFoundingRegistrationWaiverMax()).toBe(30);
    expect(isTrainerFoundingBgPercentTier(0)).toBe(true);
    expect(isTrainerFoundingBgPercentTier(29)).toBe(true);
    expect(isTrainerFoundingBgPercentTier(30)).toBe(false);
  });

  it("uses defaults for founding sales bonus caps", () => {
    expect(getFoundingTrainerSalesBonusMaxTrainers()).toBe(30);
    expect(getFoundingTrainerSalesBonusMaxSales()).toBe(5);
    expect(getFoundingTrainerSalesBonusPercent()).toBe(5);
    expect(isFoundingTrainerBySignupRank(29)).toBe(true);
    expect(isFoundingTrainerBySignupRank(30)).toBe(false);
    expect(isFoundingTrainerSalesBonusEligibleDate(new Date("2026-06-01T12:00:00Z"))).toBe(true);
    expect(isFoundingTrainerSalesBonusEligibleDate(new Date("2027-01-02T12:00:00Z"))).toBe(false);
  });
});

describe("trainer-registration-fee", () => {
  it("founding tier charges 20% of Checkr amount", () => {
    const r = computeTrainerRegistrationDueCents({
      pricingMode: "FOUNDING_BG_SURCHARGE_20PCT",
      backgroundCheckVendorPaidCents: 4900,
    });
    expect(r.dueCents).toBe(980);
    expect(r.error).toBeUndefined();
  });

  it("standard tier charges platform portion of $100 total", () => {
    const r = computeTrainerRegistrationDueCents({
      pricingMode: "STANDARD_100_MINUS_BG",
      backgroundCheckVendorPaidCents: 4900,
    });
    expect(r.dueCents).toBe(5100);
  });

  it("standard breakdown splits $100 between background check and platform fee", () => {
    const breakdown = computeStandardTrainerRegistrationBreakdown(4900);
    expect(breakdown.totalCents).toBe(TRAINER_PLATFORM_REGISTRATION_FEE_CENTS);
    expect(breakdown.backgroundCheckCents).toBe(4900);
    expect(breakdown.platformCents).toBe(5100);
    expect(breakdown.backgroundCheckCents + breakdown.platformCents).toBe(breakdown.totalCents);
    expect(describeStandardTrainerRegistrationBreakdown(4900)).toBe(
      "$49.00 background check + $51.00 Match Fit platform sign-up fee = $100.00 total (USD)",
    );
    expect(formatTrainerRegistrationUsd(5100)).toBe("$51.00");
  });
});
