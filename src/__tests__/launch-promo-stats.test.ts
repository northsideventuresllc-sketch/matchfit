import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  countLaunchClientsMock,
  countLaunchTrainersMock,
  clientBetaSlotsUsedMock,
  trainerBetaSlotsUsedMock,
  isBetaLaunchGatesEnabledMock,
  betaMaxClientsMock,
  betaMaxTotalTrainersMock,
  betaMaxVirtualTrainersBaseMock,
  betaMaxInPersonTrainersMock,
  getTrainerFoundingBgPercentMaxMock,
  getClientFoundingTrialMaxClientsMock,
  getTrainerBetaSlotSnapshotMock,
} = vi.hoisted(() => ({
  countLaunchClientsMock: vi.fn(),
  countLaunchTrainersMock: vi.fn(),
  clientBetaSlotsUsedMock: vi.fn(),
  trainerBetaSlotsUsedMock: vi.fn(),
  isBetaLaunchGatesEnabledMock: vi.fn(),
  betaMaxClientsMock: vi.fn(),
  betaMaxTotalTrainersMock: vi.fn(),
  betaMaxVirtualTrainersBaseMock: vi.fn(),
  betaMaxInPersonTrainersMock: vi.fn(),
  getTrainerFoundingBgPercentMaxMock: vi.fn(),
  getClientFoundingTrialMaxClientsMock: vi.fn(),
  getTrainerBetaSlotSnapshotMock: vi.fn(),
}));

vi.mock("@/lib/launch-account-counts", () => ({
  countLaunchClients: countLaunchClientsMock,
  countLaunchTrainers: countLaunchTrainersMock,
}));

vi.mock("@/lib/beta-waitlist-service", () => ({
  clientBetaSlotsUsed: clientBetaSlotsUsedMock,
  trainerBetaSlotsUsed: trainerBetaSlotsUsedMock,
}));

vi.mock("@/lib/beta-trainer-slot-caps", () => ({
  getTrainerBetaSlotSnapshot: getTrainerBetaSlotSnapshotMock,
}));

vi.mock("@/lib/beta-launch-config", () => ({
  betaMaxClients: betaMaxClientsMock,
  betaMaxTotalTrainers: betaMaxTotalTrainersMock,
  betaMaxVirtualTrainersBase: betaMaxVirtualTrainersBaseMock,
  betaMaxInPersonTrainers: betaMaxInPersonTrainersMock,
  isBetaLaunchGatesEnabled: isBetaLaunchGatesEnabledMock,
}));

vi.mock("@/lib/match-fit-launch-promotions", () => ({
  getTrainerFoundingBgPercentMax: getTrainerFoundingBgPercentMaxMock,
  getClientFoundingTrialMaxClients: getClientFoundingTrialMaxClientsMock,
  getFoundingTrainerSalesBonusMaxTrainers: () => 30,
  getFoundingTrainerSalesBonusMaxSales: () => 5,
  getFoundingTrainerSalesBonusPercent: () => 5,
  isFoundingTrainerSalesBonusEligibleDate: () => true,
}));

import { getLaunchPromoStats } from "@/lib/launch-promo-stats";

const defaultSnapshot = {
  totalUsed: 3,
  virtualUsed: 3,
  inPersonUsed: 0,
  totalMax: 100,
  inPersonMax: 10,
  effectiveVirtualMax: 20,
  totalRemaining: 97,
  virtualRemaining: 17,
  inPersonRemaining: 10,
};

describe("getLaunchPromoStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isBetaLaunchGatesEnabledMock.mockReturnValue(true);
    betaMaxTotalTrainersMock.mockReturnValue(100);
    betaMaxClientsMock.mockReturnValue(50);
    betaMaxVirtualTrainersBaseMock.mockReturnValue(20);
    betaMaxInPersonTrainersMock.mockReturnValue(10);
    getTrainerFoundingBgPercentMaxMock.mockReturnValue(10);
    getClientFoundingTrialMaxClientsMock.mockReturnValue(50);
    getTrainerBetaSlotSnapshotMock.mockResolvedValue(defaultSnapshot);
    countLaunchTrainersMock.mockResolvedValue(2);
    countLaunchClientsMock.mockResolvedValue(12);
    trainerBetaSlotsUsedMock.mockResolvedValue(3);
    clientBetaSlotsUsedMock.mockResolvedValue(4);
  });

  it("derives founding remaining from launch counts (excludes test accounts at source)", async () => {
    const stats = await getLaunchPromoStats();

    expect(stats.trainerCount).toBe(2);
    expect(stats.clientCount).toBe(12);
    expect(stats.trainerFoundingRemaining).toBe(8);
    expect(stats.clientFoundingRemaining).toBe(38);
    expect(stats.trainerFoundingActive).toBe(true);
    expect(stats.clientFoundingActive).toBe(true);
    expect(stats.trainerVirtualSlotsRemaining).toBe(17);
    expect(stats.trainerInPersonSlotsRemaining).toBe(10);
  });

  it("skips beta slot usage when gates are disabled", async () => {
    isBetaLaunchGatesEnabledMock.mockReturnValueOnce(false);

    const stats = await getLaunchPromoStats();

    expect(stats.gatesEnabled).toBe(false);
    expect(stats.trainerBetaSlotsUsed).toBe(0);
    expect(stats.clientBetaSlotsUsed).toBe(0);
    expect(stats.trainerWaitlistOpen).toBe(false);
    expect(stats.trainerTotalCapFull).toBe(false);
    expect(stats.clientWaitlistOpen).toBe(false);
    expect(stats.inPersonOfferingAvailable).toBe(true);
    expect(trainerBetaSlotsUsedMock).not.toHaveBeenCalled();
    expect(clientBetaSlotsUsedMock).not.toHaveBeenCalled();
    expect(getTrainerBetaSlotSnapshotMock).not.toHaveBeenCalled();
  });

  it("marks client waitlist open when beta slots used meets cap", async () => {
    betaMaxClientsMock.mockReturnValueOnce(4);
    clientBetaSlotsUsedMock.mockResolvedValueOnce(4);

    const stats = await getLaunchPromoStats();

    expect(stats.clientWaitlistOpen).toBe(true);
    expect(stats.clientBetaSlotsRemaining).toBe(0);
  });

  it("marks trainer waitlist open when a bucket is full even if total cap is not", async () => {
    getTrainerBetaSlotSnapshotMock.mockResolvedValueOnce({
      ...defaultSnapshot,
      inPersonRemaining: 0,
      totalRemaining: 50,
    });

    const stats = await getLaunchPromoStats();

    expect(stats.trainerTotalCapFull).toBe(false);
    expect(stats.trainerInPersonCapFull).toBe(true);
    expect(stats.trainerWaitlistOpen).toBe(true);
    expect(stats.inPersonOfferingAvailable).toBe(false);
  });

  it("marks trainer total cap full separately from waitlist buckets", async () => {
    betaMaxTotalTrainersMock.mockReturnValueOnce(3);
    trainerBetaSlotsUsedMock.mockResolvedValueOnce(3);
    getTrainerBetaSlotSnapshotMock.mockResolvedValueOnce({
      ...defaultSnapshot,
      totalRemaining: 0,
      virtualRemaining: 0,
      inPersonRemaining: 0,
    });

    const stats = await getLaunchPromoStats();

    expect(stats.trainerTotalCapFull).toBe(true);
    expect(stats.trainerWaitlistOpen).toBe(true);
  });
});
