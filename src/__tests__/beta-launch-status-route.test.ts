import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  countClientsForBetaCapMock,
  countTrainersForBetaCapMock,
  clientBetaSlotsUsedMock,
  trainerBetaSlotsUsedMock,
  isClientBetaCapReachedMock,
  isTrainerBetaCapReachedMock,
  betaMaxClientsMock,
  betaMaxTrainersMock,
  isBetaLaunchGatesEnabledMock,
} = vi.hoisted(() => ({
  countClientsForBetaCapMock: vi.fn(),
  countTrainersForBetaCapMock: vi.fn(),
  clientBetaSlotsUsedMock: vi.fn(),
  trainerBetaSlotsUsedMock: vi.fn(),
  isClientBetaCapReachedMock: vi.fn(),
  isTrainerBetaCapReachedMock: vi.fn(),
  betaMaxClientsMock: vi.fn(),
  betaMaxTrainersMock: vi.fn(),
  isBetaLaunchGatesEnabledMock: vi.fn(),
}));

vi.mock("@/lib/beta-waitlist-service", () => ({
  clientBetaSlotsUsed: clientBetaSlotsUsedMock,
  countClientsForBetaCap: countClientsForBetaCapMock,
  countTrainersForBetaCap: countTrainersForBetaCapMock,
  isClientBetaCapReached: isClientBetaCapReachedMock,
  isTrainerBetaCapReached: isTrainerBetaCapReachedMock,
  trainerBetaSlotsUsed: trainerBetaSlotsUsedMock,
}));

vi.mock("@/lib/beta-launch-config", () => ({
  betaMaxClients: betaMaxClientsMock,
  betaMaxTrainers: betaMaxTrainersMock,
  isBetaLaunchGatesEnabled: isBetaLaunchGatesEnabledMock,
}));

import { GET, dynamic } from "@/app/api/public/beta-launch-status/route";

describe("GET /api/public/beta-launch-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isBetaLaunchGatesEnabledMock.mockReturnValue(true);
    betaMaxTrainersMock.mockReturnValue(100);
    betaMaxClientsMock.mockReturnValue(200);
    countTrainersForBetaCapMock.mockResolvedValue(75);
    countClientsForBetaCapMock.mockResolvedValue(180);
    trainerBetaSlotsUsedMock.mockResolvedValue(90);
    clientBetaSlotsUsedMock.mockResolvedValue(195);
    isTrainerBetaCapReachedMock.mockResolvedValue(false);
    isClientBetaCapReachedMock.mockResolvedValue(true);
  });

  it("is configured as force-dynamic", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns gates-disabled payload with null counters", async () => {
    isBetaLaunchGatesEnabledMock.mockReturnValueOnce(false);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      gatesEnabled: false,
      trainerCap: null,
      clientCap: null,
      trainerCount: null,
      clientCount: null,
      trainerSlotsUsed: null,
      clientSlotsUsed: null,
      trainerSlotsRemaining: null,
      clientSlotsRemaining: null,
      trainerWaitlistOpen: false,
      clientWaitlistOpen: false,
    });
    expect(countTrainersForBetaCapMock).not.toHaveBeenCalled();
    expect(countClientsForBetaCapMock).not.toHaveBeenCalled();
  });

  it("returns beta status payload when gates are enabled", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      gatesEnabled: true,
      trainerCap: 100,
      clientCap: 200,
      trainerCount: 75,
      clientCount: 180,
      trainerSlotsUsed: 90,
      clientSlotsUsed: 195,
      trainerSlotsRemaining: 10,
      clientSlotsRemaining: 5,
      trainerWaitlistOpen: false,
      clientWaitlistOpen: true,
    });
  });

  it("clamps remaining slots to zero when used exceeds cap", async () => {
    betaMaxTrainersMock.mockReturnValueOnce(3);
    betaMaxClientsMock.mockReturnValueOnce(4);
    trainerBetaSlotsUsedMock.mockResolvedValueOnce(10);
    clientBetaSlotsUsedMock.mockResolvedValueOnce(9);

    const response = await GET();
    const body = await response.json();

    expect(body.trainerSlotsRemaining).toBe(0);
    expect(body.clientSlotsRemaining).toBe(0);
  });
});
