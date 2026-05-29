import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  isBetaLaunchGatesEnabledMock,
  betaMaxClientsMock,
  countLaunchClientsInTxMock,
  getTrainerBetaSlotSnapshotInTxMock,
  getTrainerBetaSlotSnapshotMock,
  clientBetaSlotsUsedMock,
} = vi.hoisted(() => ({
  isBetaLaunchGatesEnabledMock: vi.fn(),
  betaMaxClientsMock: vi.fn(),
  countLaunchClientsInTxMock: vi.fn(),
  getTrainerBetaSlotSnapshotInTxMock: vi.fn(),
  getTrainerBetaSlotSnapshotMock: vi.fn(),
  clientBetaSlotsUsedMock: vi.fn(),
}));

vi.mock("@/lib/beta-launch-config", () => ({
  isBetaLaunchGatesEnabled: isBetaLaunchGatesEnabledMock,
  betaMaxClients: betaMaxClientsMock,
}));

vi.mock("@/lib/beta-waitlist-service", () => ({
  countActiveClientBetaInvites: vi.fn().mockResolvedValue(0),
  getTrainerBetaSlotSnapshotInTx: getTrainerBetaSlotSnapshotInTxMock,
  clientBetaSlotsUsed: clientBetaSlotsUsedMock,
}));

vi.mock("@/lib/beta-trainer-slot-caps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/beta-trainer-slot-caps")>();
  return {
    ...actual,
    getTrainerBetaSlotSnapshot: getTrainerBetaSlotSnapshotMock,
  };
});

vi.mock("@/lib/launch-account-counts", () => ({
  countLaunchClientsInTx: countLaunchClientsInTxMock,
}));

import {
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

const virtualOnlyPrefs = { wantsVirtual: true, wantsInPerson: false };

describe("beta-cap-enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isBetaLaunchGatesEnabledMock.mockReturnValue(true);
    betaMaxClientsMock.mockReturnValue(20);
    countLaunchClientsInTxMock.mockResolvedValue(5);
    clientBetaSlotsUsedMock.mockResolvedValue(7);
    getTrainerBetaSlotSnapshotMock.mockResolvedValue({ totalRemaining: 27 });
    getTrainerBetaSlotSnapshotInTxMock.mockResolvedValue({
      totalUsed: 3,
      virtualUsed: 3,
      inPersonUsed: 0,
      totalMax: 30,
      inPersonMax: 10,
      effectiveVirtualMax: 30,
      totalRemaining: 27,
      virtualRemaining: 27,
      inPersonRemaining: 10,
    });
  });

  it("bypasses trainer slot assertion when beta gates are disabled", async () => {
    isBetaLaunchGatesEnabledMock.mockReturnValueOnce(false);
    const tx = makeTx();

    await expect(assertTrainerBetaSlotInTransaction(tx as never, null, virtualOnlyPrefs)).resolves.toBeUndefined();
    expect(getTrainerBetaSlotSnapshotInTxMock).not.toHaveBeenCalled();
  });

  it("allows trainer signup when bucket slots remain", async () => {
    const tx = makeTx();
    await expect(assertTrainerBetaSlotInTransaction(tx as never, null, virtualOnlyPrefs)).resolves.toBeUndefined();
  });

  it("throws in-person cap error when in-person bucket is full", async () => {
    getTrainerBetaSlotSnapshotInTxMock.mockResolvedValueOnce({
      totalUsed: 20,
      virtualUsed: 10,
      inPersonUsed: 10,
      totalMax: 30,
      inPersonMax: 10,
      effectiveVirtualMax: 20,
      totalRemaining: 10,
      virtualRemaining: 10,
      inPersonRemaining: 0,
    });
    const tx = makeTx();

    await expect(
      assertTrainerBetaSlotInTransaction(tx as never, null, { wantsVirtual: true, wantsInPerson: true }),
    ).rejects.toMatchObject({
      code: "BETA_TRAINER_IN_PERSON_CAP",
    } satisfies Partial<BetaCapExceededError>);
  });

  it("returns available slot counts", async () => {
    getTrainerBetaSlotSnapshotMock.mockResolvedValueOnce({ totalRemaining: 2 });
    betaMaxClientsMock.mockReturnValue(5);
    clientBetaSlotsUsedMock.mockResolvedValue(11);

    await expect(trainerBetaSlotsAvailable()).resolves.toBe(2);
    await expect(clientBetaSlotsAvailable()).resolves.toBe(0);
  });
});
