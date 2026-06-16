import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getClientFoundingTrialDays,
  getClientFoundingTrialMaxClients,
  getClientPostCapTrialDays,
  getTrainerFoundingBgPercentMax,
  getTrainerFoundingRegistrationWaiverMax,
  isNextClientEligibleForFoundingTrial,
  isNextTrainerEligibleForRegistrationWaiver,
  isTrainerFoundingBgPercentTier,
} from "@/lib/match-fit-launch-promotion-caps";

describe("match-fit-launch-promotion-caps", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    delete process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_MAX_CLIENTS;
    delete process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_DAYS;
    delete process.env.MATCH_FIT_CLIENT_POST_CAP_TRIAL_DAYS;
    delete process.env.MATCH_FIT_TRAINER_FOUNDING_BG_PERCENT_MAX;
    delete process.env.MATCH_FIT_TRAINER_FOUNDING_BG_COVERED_MAX;
    delete process.env.MATCH_FIT_TRAINER_FOUNDING_REGISTRATION_WAIVER_MAX;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("uses expected defaults when env values are unset", () => {
    expect(getTrainerFoundingBgPercentMax()).toBe(10);
    expect(getTrainerFoundingRegistrationWaiverMax()).toBe(10);
    expect(getClientFoundingTrialMaxClients()).toBe(150);
    expect(getClientFoundingTrialDays()).toBe(14);
    expect(getClientPostCapTrialDays()).toBe(3);
  });

  it("falls back to defaults for invalid env values", () => {
    process.env.MATCH_FIT_TRAINER_FOUNDING_BG_PERCENT_MAX = "0";
    process.env.MATCH_FIT_TRAINER_FOUNDING_REGISTRATION_WAIVER_MAX = "-2";
    process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_MAX_CLIENTS = "abc";
    process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_DAYS = "";
    process.env.MATCH_FIT_CLIENT_POST_CAP_TRIAL_DAYS = " ";

    expect(getTrainerFoundingBgPercentMax()).toBe(10);
    expect(getTrainerFoundingRegistrationWaiverMax()).toBe(10);
    expect(getClientFoundingTrialMaxClients()).toBe(150);
    expect(getClientFoundingTrialDays()).toBe(14);
    expect(getClientPostCapTrialDays()).toBe(3);
  });

  it("clamps env values to their upper bounds", () => {
    process.env.MATCH_FIT_TRAINER_FOUNDING_BG_PERCENT_MAX = "9999999";
    process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_MAX_CLIENTS = "9999999";
    process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_DAYS = "5000";
    process.env.MATCH_FIT_CLIENT_POST_CAP_TRIAL_DAYS = "1000";

    expect(getTrainerFoundingBgPercentMax()).toBe(1_000_000);
    expect(getClientFoundingTrialMaxClients()).toBe(1_000_000);
    expect(getClientFoundingTrialDays()).toBe(730);
    expect(getClientPostCapTrialDays()).toBe(90);
  });

  it("prefers legacy trainer waiver env when present", () => {
    process.env.MATCH_FIT_TRAINER_FOUNDING_BG_PERCENT_MAX = "44";
    process.env.MATCH_FIT_TRAINER_FOUNDING_REGISTRATION_WAIVER_MAX = "17";

    expect(getTrainerFoundingBgPercentMax()).toBe(44);
    expect(getTrainerFoundingRegistrationWaiverMax()).toBe(17);
  });

  it("uses boundary-safe eligibility checks", () => {
    process.env.MATCH_FIT_TRAINER_FOUNDING_BG_PERCENT_MAX = "2";
    process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_MAX_CLIENTS = "3";

    expect(isTrainerFoundingBgPercentTier(0)).toBe(true);
    expect(isTrainerFoundingBgPercentTier(1)).toBe(true);
    expect(isTrainerFoundingBgPercentTier(2)).toBe(false);

    expect(isNextTrainerEligibleForRegistrationWaiver(1)).toBe(true);
    expect(isNextTrainerEligibleForRegistrationWaiver(2)).toBe(false);

    expect(isNextClientEligibleForFoundingTrial(2)).toBe(true);
    expect(isNextClientEligibleForFoundingTrial(3)).toBe(false);
  });
});
