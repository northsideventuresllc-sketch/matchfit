import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  countLaunchClientsMock,
  countLaunchTrainersMock,
  clientBetaSlotsUsedMock,
  trainerBetaSlotsUsedMock,
  atlantaTrainerBetaPoolSlotsUsedMock,
  virtualTrainerBetaPoolSlotsUsedMock,
  isBetaLaunchGatesEnabledMock,
  betaMaxClientsMock,
  betaMaxTrainersAtlantaMock,
  betaMaxTrainersVirtualMock,
  getTrainerFoundingBgPercentMaxMock,
  getClientFoundingTrialMaxClientsMock,
} = vi.hoisted(() => ({
  countLaunchClientsMock: vi.fn(),
  countLaunchTrainersMock: vi.fn(),
  clientBetaSlotsUsedMock: vi.fn(),
  trainerBetaSlotsUsedMock: vi.fn(),
  atlantaTrainerBetaPoolSlotsUsedMock: vi.fn(),
  virtualTrainerBetaPoolSlotsUsedMock: vi.fn(),
  isBetaLaunchGatesEnabledMock: vi.fn(),
  betaMaxClientsMock: vi.fn(),
  betaMaxTrainersAtlantaMock: vi.fn(),
  betaMaxTrainersVirtualMock: vi.fn(),
  getTrainerFoundingBgPercentMaxMock: vi.fn(),
  getClientFoundingTrialMaxClientsMock: vi.fn(),
}));

vi.mock("@/lib/launch-account-counts", () => ({
  countLaunchClients: countLaunchClientsMock,
  countLaunchTrainers: countLaunchTrainersMock,
}));

vi.mock("@/lib/beta-waitlist-service", () => ({
  clientBetaSlotsUsed: clientBetaSlotsUsedMock,
  trainerBetaSlotsUsed: trainerBetaSlotsUsedMock,
}));

vi.mock("@/lib/beta-trainer-pool", () => ({
  atlantaTrainerBetaPoolSlotsUsed: atlantaTrainerBetaPoolSlotsUsedMock,
  virtualTrainerBetaPoolSlotsUsed: virtualTrainerBetaPoolSlotsUsedMock,
}));

vi.mock("@/lib/beta-launch-config", () => ({
  betaMaxClients: betaMaxClientsMock,
  betaMaxTrainersAtlanta: betaMaxTrainersAtlantaMock,
  betaMaxTrainersVirtual: betaMaxTrainersVirtualMock,
  isBetaLaunchGatesEnabled: isBetaLaunchGatesEnabledMock,
}));

vi.mock("@/lib/match-fit-launch-promotions", () => ({
  getTrainerFoundingBgPercentMax: getTrainerFoundingBgPercentMaxMock,
  getClientFoundingTrialMaxClients: getClientFoundingTrialMaxClientsMock,
}));

import { getLaunchPromoStats } from "@/lib/launch-promo-stats";

describe("getLaunchPromoStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isBetaLaunchGatesEnabledMock.mockReturnValue(true);
    betaMaxTrainersAtlantaMock.mockReturnValue(10);
    betaMaxTrainersVirtualMock.mockReturnValue(20);
    betaMaxClientsMock.mockReturnValue(50);
    getTrainerFoundingBgPercentMaxMock.mockReturnValue(30);
    getClientFoundingTrialMaxClientsMock.mockReturnValue(150);
    countLaunchTrainersMock.mockResolvedValue(2);
    countLaunchClientsMock.mockResolvedValue(12);
    trainerBetaSlotsUsedMock.mockResolvedValue(3);
    clientBetaSlotsUsedMock.mockResolvedValue(4);
    atlantaTrainerBetaPoolSlotsUsedMock.mockResolvedValue(1);
    virtualTrainerBetaPoolSlotsUsedMock.mockResolvedValue(2);
  });

  it("derives founding remaining from launch counts (excludes test accounts at source)", async () => {
    const stats = await getLaunchPromoStats();

    expect(stats.trainerCount).toBe(2);
    expect(stats.clientCount).toBe(12);
    expect(stats.trainerFoundingRemaining).toBe(28);
    expect(stats.clientFoundingRemaining).toBe(138);
    expect(stats.trainerFoundingActive).toBe(true);
    expect(stats.clientFoundingActive).toBe(true);
  });

  it("skips beta slot usage when gates are disabled", async () => {
    isBetaLaunchGatesEnabledMock.mockReturnValueOnce(false);

    const stats = await getLaunchPromoStats();

    expect(stats.gatesEnabled).toBe(false);
    expect(stats.trainerBetaSlotsUsed).toBe(0);
    expect(stats.clientBetaSlotsUsed).toBe(0);
    expect(stats.trainerWaitlistOpen).toBe(false);
    expect(stats.clientWaitlistOpen).toBe(false);
    expect(trainerBetaSlotsUsedMock).not.toHaveBeenCalled();
    expect(clientBetaSlotsUsedMock).not.toHaveBeenCalled();
    expect(atlantaTrainerBetaPoolSlotsUsedMock).not.toHaveBeenCalled();
    expect(virtualTrainerBetaPoolSlotsUsedMock).not.toHaveBeenCalled();
  });

  it("marks waitlist open when beta slots used meets cap", async () => {
    betaMaxClientsMock.mockReturnValueOnce(4);
    clientBetaSlotsUsedMock.mockResolvedValueOnce(4);

    const stats = await getLaunchPromoStats();

    expect(stats.clientWaitlistOpen).toBe(true);
    expect(stats.clientBetaSlotsRemaining).toBe(0);
  });
});
