import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  isBetaLaunchGatesEnabledMock,
  betaMaxTrainersMock,
  betaMaxClientsMock,
  countLaunchTrainersInTxMock,
  countLaunchClientsInTxMock,
  countActiveTrainerBetaInvitesMock,
  countActiveClientBetaInvitesMock,
  trainerBetaSlotsUsedMock,
  clientBetaSlotsUsedMock,
} = vi.hoisted(() => ({
  isBetaLaunchGatesEnabledMock: vi.fn(),
  betaMaxTrainersMock: vi.fn(),
  betaMaxClientsMock: vi.fn(),
  countLaunchTrainersInTxMock: vi.fn(),
  countLaunchClientsInTxMock: vi.fn(),
  countActiveTrainerBetaInvitesMock: vi.fn(),
  countActiveClientBetaInvitesMock: vi.fn(),
  trainerBetaSlotsUsedMock: vi.fn(),
  clientBetaSlotsUsedMock: vi.fn(),
}));

vi.mock("@/lib/beta-launch-config", () => ({
  isBetaLaunchGatesEnabled: isBetaLaunchGatesEnabledMock,
  betaMaxTrainers: betaMaxTrainersMock,
  betaMaxClients: betaMaxClientsMock,
}));

vi.mock("@/lib/launch-account-counts", () => ({
  countLaunchTrainersInTx: countLaunchTrainersInTxMock,
  countLaunchClientsInTx: countLaunchClientsInTxMock,
}));

vi.mock("@/lib/beta-waitlist-service", () => ({
  countActiveTrainerBetaInvites: countActiveTrainerBetaInvitesMock,
  countActiveClientBetaInvites: countActiveClientBetaInvitesMock,
  trainerBetaSlotsUsed: trainerBetaSlotsUsedMock,
  clientBetaSlotsUsed: clientBetaSlotsUsedMock,
}));

import {
  assertClientBetaSlotForFinalize,
  assertClientBetaSlotInTransaction,
  assertTrainerBetaSlotInTransaction,
  BetaCapExceededError,
  clientBetaSlotsAvailable,
  trainerBetaSlotsAvailable,
} from "@/lib/beta-cap-enforcement";

function makeTx() {
  return {
    betaTrainerWaitlistEntry: {
      findFirst: vi.fn(),
    },
    betaClientWaitlistEntry: {
      findFirst: vi.fn(),
    },
  };
}

describe("beta-cap-enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isBetaLaunchGatesEnabledMock.mockReturnValue(true);
    betaMaxTrainersMock.mockReturnValue(10);
    betaMaxClientsMock.mockReturnValue(20);
    countLaunchTrainersInTxMock.mockResolvedValue(3);
    countLaunchClientsInTxMock.mockResolvedValue(5);
    countActiveTrainerBetaInvitesMock.mockResolvedValue(2);
    countActiveClientBetaInvitesMock.mockResolvedValue(3);
    trainerBetaSlotsUsedMock.mockResolvedValue(6);
    clientBetaSlotsUsedMock.mockResolvedValue(7);
  });

  it("bypasses trainer slot assertion when beta gates are disabled", async () => {
    isBetaLaunchGatesEnabledMock.mockReturnValueOnce(false);
    const tx = makeTx();

    await expect(assertTrainerBetaSlotInTransaction(tx as never, null)).resolves.toBeUndefined();
    expect(countLaunchTrainersInTxMock).not.toHaveBeenCalled();
    expect(tx.betaTrainerWaitlistEntry.findFirst).not.toHaveBeenCalled();
  });

  it("allows trainer signup when used slots stay below cap", async () => {
    countLaunchTrainersInTxMock.mockResolvedValueOnce(4);
    countActiveTrainerBetaInvitesMock.mockResolvedValueOnce(3);
    betaMaxTrainersMock.mockReturnValueOnce(10);
    const tx = makeTx();

    await expect(assertTrainerBetaSlotInTransaction(tx as never, null)).resolves.toBeUndefined();
    expect(tx.betaTrainerWaitlistEntry.findFirst).not.toHaveBeenCalled();
  });

  it("allows trainer signup at cap when invite slot is still valid", async () => {
    countLaunchTrainersInTxMock.mockResolvedValueOnce(6);
    countActiveTrainerBetaInvitesMock.mockResolvedValueOnce(4);
    betaMaxTrainersMock.mockReturnValueOnce(10);
    const tx = makeTx();
    tx.betaTrainerWaitlistEntry.findFirst.mockResolvedValueOnce({ id: "invite_1" });

    await expect(assertTrainerBetaSlotInTransaction(tx as never, "invite_1")).resolves.toBeUndefined();
    expect(tx.betaTrainerWaitlistEntry.findFirst).toHaveBeenCalledWith({
      where: {
        id: "invite_1",
        status: "INVITED",
        slotExpiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    });
  });

  it("throws BetaCapExceededError when trainer cap is full and invite is invalid", async () => {
    countLaunchTrainersInTxMock.mockResolvedValueOnce(8);
    countActiveTrainerBetaInvitesMock.mockResolvedValueOnce(2);
    betaMaxTrainersMock.mockReturnValueOnce(10);
    const tx = makeTx();
    tx.betaTrainerWaitlistEntry.findFirst.mockResolvedValueOnce(null);

    await expect(assertTrainerBetaSlotInTransaction(tx as never, "invite_missing")).rejects.toMatchObject({
      name: "BetaCapExceededError",
      code: "BETA_TRAINER_CAP",
    } satisfies Partial<BetaCapExceededError>);
  });

  it("allows client reservation at cap when client invite is valid", async () => {
    countLaunchClientsInTxMock.mockResolvedValueOnce(15);
    countActiveClientBetaInvitesMock.mockResolvedValueOnce(5);
    betaMaxClientsMock.mockReturnValueOnce(20);
    const tx = makeTx();
    tx.betaClientWaitlistEntry.findFirst.mockResolvedValueOnce({ id: "client_invite_1" });

    await expect(assertClientBetaSlotInTransaction(tx as never, "client_invite_1")).resolves.toBeUndefined();
    expect(tx.betaClientWaitlistEntry.findFirst).toHaveBeenCalledWith({
      where: {
        id: "client_invite_1",
        status: "INVITED",
        slotExpiresAt: { gt: expect.any(Date) },
      },
      select: { id: true },
    });
  });

  it("throws client cap error in finalize guard when slots are full", async () => {
    countLaunchClientsInTxMock.mockResolvedValueOnce(17);
    countActiveClientBetaInvitesMock.mockResolvedValueOnce(3);
    betaMaxClientsMock.mockReturnValueOnce(20);
    const tx = makeTx();
    tx.betaClientWaitlistEntry.findFirst.mockResolvedValueOnce(null);

    await expect(assertClientBetaSlotForFinalize(tx as never, "expired_client_invite")).rejects.toMatchObject({
      name: "BetaCapExceededError",
      code: "BETA_CLIENT_CAP",
    } satisfies Partial<BetaCapExceededError>);
  });

  it("returns infinite available slots when beta gates are disabled", async () => {
    isBetaLaunchGatesEnabledMock.mockReturnValue(false);

    await expect(trainerBetaSlotsAvailable()).resolves.toBe(Number.POSITIVE_INFINITY);
    await expect(clientBetaSlotsAvailable()).resolves.toBe(Number.POSITIVE_INFINITY);
  });

  it("returns available slot count using non-negative floor", async () => {
    isBetaLaunchGatesEnabledMock.mockReturnValue(true);
    betaMaxTrainersMock.mockReturnValue(8);
    trainerBetaSlotsUsedMock.mockResolvedValue(6);
    betaMaxClientsMock.mockReturnValue(5);
    clientBetaSlotsUsedMock.mockResolvedValue(11);

    await expect(trainerBetaSlotsAvailable()).resolves.toBe(2);
    await expect(clientBetaSlotsAvailable()).resolves.toBe(0);
  });
});
