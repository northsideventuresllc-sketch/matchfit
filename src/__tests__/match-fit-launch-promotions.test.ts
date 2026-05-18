import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getClientFoundingTrialDays,
  getClientFoundingTrialMaxClients,
  getTrainerFoundingRegistrationWaiverMax,
  isNextClientEligibleForFoundingTrial,
  isNextTrainerEligibleForRegistrationWaiver,
} from "@/lib/match-fit-launch-promotions";

describe("match-fit-launch-promotions", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_MAX_CLIENTS;
    delete process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_DAYS;
    delete process.env.MATCH_FIT_TRAINER_FOUNDING_REGISTRATION_WAIVER_MAX;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("uses defaults for client trial caps", () => {
    expect(getClientFoundingTrialMaxClients()).toBe(10);
    expect(getClientFoundingTrialDays()).toBe(30);
    expect(isNextClientEligibleForFoundingTrial(0)).toBe(true);
    expect(isNextClientEligibleForFoundingTrial(9)).toBe(true);
    expect(isNextClientEligibleForFoundingTrial(10)).toBe(false);
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

  it("uses defaults for trainer registration waiver", () => {
    expect(getTrainerFoundingRegistrationWaiverMax()).toBe(3);
    expect(isNextTrainerEligibleForRegistrationWaiver(0)).toBe(true);
    expect(isNextTrainerEligibleForRegistrationWaiver(2)).toBe(true);
    expect(isNextTrainerEligibleForRegistrationWaiver(3)).toBe(false);
  });
});
