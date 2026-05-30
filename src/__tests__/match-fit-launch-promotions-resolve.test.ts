import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { countLaunchClientsMock, countLaunchTrainersMock } = vi.hoisted(() => ({
  countLaunchClientsMock: vi.fn(),
  countLaunchTrainersMock: vi.fn(),
}));

vi.mock("@/lib/launch-account-counts", () => ({
  countLaunchClients: countLaunchClientsMock,
  countLaunchTrainers: countLaunchTrainersMock,
}));

import {
  resolveClientSubscriptionBilling,
  trainerCountBeforeNextRegistration,
} from "@/lib/match-fit-launch-promotions";

describe("match-fit-launch-promotions resolver helpers", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_MAX_CLIENTS = "5";
    process.env.MATCH_FIT_CLIENT_FOUNDING_TRIAL_DAYS = "14";
    process.env.MATCH_FIT_CLIENT_POST_CAP_TRIAL_DAYS = "3";
    countLaunchClientsMock.mockResolvedValue(0);
    countLaunchTrainersMock.mockResolvedValue(0);
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("returns founding trial details when a founding slot is still available", async () => {
    countLaunchClientsMock.mockResolvedValueOnce(4);

    await expect(resolveClientSubscriptionBilling({})).resolves.toEqual({
      foundingSlot: true,
      trialDays: 14,
      choice: "founding_trial_14d",
    });
  });

  it("defaults to a post-cap 3-day trial when founding cap is reached", async () => {
    countLaunchClientsMock.mockResolvedValueOnce(5);

    await expect(resolveClientSubscriptionBilling({})).resolves.toEqual({
      foundingSlot: false,
      trialDays: 3,
      choice: "trial_3d",
    });
  });

  it("supports pay-now outside founding slots", async () => {
    countLaunchClientsMock.mockResolvedValueOnce(99);

    await expect(resolveClientSubscriptionBilling({ billingChoice: "pay_now" })).resolves.toEqual({
      foundingSlot: false,
      trialDays: 0,
      choice: "pay_now",
    });
  });

  it("returns trainer count before next registration", async () => {
    countLaunchTrainersMock.mockResolvedValueOnce(42);

    await expect(trainerCountBeforeNextRegistration()).resolves.toBe(42);
    expect(countLaunchTrainersMock).toHaveBeenCalledTimes(1);
  });
});
