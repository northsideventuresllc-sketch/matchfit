import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getClientFoundingTrialDays,
  getClientFoundingTrialMaxClients,
  getClientPostCapTrialDays,
  getTrainerFoundingBgPercentMax,
  getTrainerFoundingRegistrationWaiverMax,
  isNextClientEligibleForFoundingTrial,
  isTrainerFoundingBgPercentTier,
} from "@/lib/match-fit-launch-promotions";
import { computeTrainerRegistrationDueCents } from "@/lib/trainer-registration-fee";

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
    expect(getClientFoundingTrialMaxClients()).toBe(50);
    expect(getClientFoundingTrialDays()).toBe(14);
    expect(getClientPostCapTrialDays()).toBe(3);
    expect(isNextClientEligibleForFoundingTrial(0)).toBe(true);
    expect(isNextClientEligibleForFoundingTrial(49)).toBe(true);
    expect(isNextClientEligibleForFoundingTrial(50)).toBe(false);
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
    expect(getTrainerFoundingBgPercentMax()).toBe(10);
    expect(getTrainerFoundingRegistrationWaiverMax()).toBe(10);
    expect(isTrainerFoundingBgPercentTier(0)).toBe(true);
    expect(isTrainerFoundingBgPercentTier(9)).toBe(true);
    expect(isTrainerFoundingBgPercentTier(10)).toBe(false);
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

  it("standard tier charges $100 minus background check", () => {
    const r = computeTrainerRegistrationDueCents({
      pricingMode: "STANDARD_100_MINUS_BG",
      backgroundCheckVendorPaidCents: 4900,
    });
    expect(r.dueCents).toBe(5100);
  });
});
