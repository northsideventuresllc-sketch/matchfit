import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockClientFindUnique,
  mockClientUpdate,
  mockClientFindMany,
  mockTrainerFindUnique,
  mockTrainerUpdate,
  mockTrainerFindMany,
  mockDeidentifyClientAccount,
  mockDeidentifyTrainerAccount,
} = vi.hoisted(() => ({
  mockClientFindUnique: vi.fn(),
  mockClientUpdate: vi.fn(),
  mockClientFindMany: vi.fn(),
  mockTrainerFindUnique: vi.fn(),
  mockTrainerUpdate: vi.fn(),
  mockTrainerFindMany: vi.fn(),
  mockDeidentifyClientAccount: vi.fn(),
  mockDeidentifyTrainerAccount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      findUnique: mockClientFindUnique,
      update: mockClientUpdate,
      findMany: mockClientFindMany,
    },
    trainer: {
      findUnique: mockTrainerFindUnique,
      update: mockTrainerUpdate,
      findMany: mockTrainerFindMany,
    },
  },
}));

vi.mock("@/lib/account-deletion", () => ({
  deidentifyClientAccount: mockDeidentifyClientAccount,
  deidentifyTrainerAccount: mockDeidentifyTrainerAccount,
}));

import {
  cancelScheduledClientAccountDeletion,
  cancelScheduledTrainerAccountDeletion,
  finalizeDueAccountDeletions,
  finalizeScheduledDeletionIfOverdue,
} from "@/lib/account-deletion-grace";

describe("account-deletion-grace workflow helpers", () => {
  beforeEach(() => {
    mockClientFindUnique.mockReset();
    mockClientUpdate.mockReset();
    mockClientFindMany.mockReset();
    mockTrainerFindUnique.mockReset();
    mockTrainerUpdate.mockReset();
    mockTrainerFindMany.mockReset();
    mockDeidentifyClientAccount.mockReset();
    mockDeidentifyTrainerAccount.mockReset();

    mockClientUpdate.mockResolvedValue(undefined);
    mockTrainerUpdate.mockResolvedValue(undefined);
    mockClientFindMany.mockResolvedValue([]);
    mockTrainerFindMany.mockResolvedValue([]);
    mockDeidentifyClientAccount.mockResolvedValue(undefined);
    mockDeidentifyTrainerAccount.mockResolvedValue(undefined);
  });

  it("cancels a scheduled client deletion during active grace", async () => {
    mockClientFindUnique.mockResolvedValueOnce({
      deidentifiedAt: null,
      accountDeletionRequestedAt: new Date(Date.now() - 5_000),
      accountDeletionFinalizeAt: new Date(Date.now() + 60_000),
    });

    await expect(cancelScheduledClientAccountDeletion("client_live")).resolves.toBe(true);
    expect(mockClientFindUnique).toHaveBeenCalledWith({
      where: { id: "client_live" },
      select: {
        deidentifiedAt: true,
        accountDeletionRequestedAt: true,
        accountDeletionFinalizeAt: true,
      },
    });
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client_live" },
      data: {
        accountDeletionRequestedAt: null,
        accountDeletionFinalizeAt: null,
      },
    });
  });

  it("does not cancel client deletion after grace has expired", async () => {
    mockClientFindUnique.mockResolvedValueOnce({
      deidentifiedAt: null,
      accountDeletionRequestedAt: new Date(Date.now() - 120_000),
      accountDeletionFinalizeAt: new Date(Date.now() - 60_000),
    });

    await expect(cancelScheduledClientAccountDeletion("client_overdue")).resolves.toBe(false);
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("cancels a scheduled trainer deletion during active grace", async () => {
    mockTrainerFindUnique.mockResolvedValueOnce({
      deidentifiedAt: null,
      accountDeletionRequestedAt: new Date(Date.now() - 10_000),
      accountDeletionFinalizeAt: new Date(Date.now() + 30_000),
    });

    await expect(cancelScheduledTrainerAccountDeletion("trainer_live")).resolves.toBe(true);
    expect(mockTrainerFindUnique).toHaveBeenCalledWith({
      where: { id: "trainer_live" },
      select: {
        deidentifiedAt: true,
        accountDeletionRequestedAt: true,
        accountDeletionFinalizeAt: true,
      },
    });
    expect(mockTrainerUpdate).toHaveBeenCalledWith({
      where: { id: "trainer_live" },
      data: {
        accountDeletionRequestedAt: null,
        accountDeletionFinalizeAt: null,
      },
    });
  });

  it("finalizes overdue client deletion and calls deidentify helper", async () => {
    mockClientFindUnique.mockResolvedValueOnce({
      deidentifiedAt: null,
      accountDeletionRequestedAt: new Date(Date.now() - 120_000),
      accountDeletionFinalizeAt: new Date(Date.now() - 60_000),
    });

    await expect(
      finalizeScheduledDeletionIfOverdue({
        role: "client",
        id: "client_due",
      }),
    ).resolves.toBe(true);
    expect(mockClientFindUnique).toHaveBeenCalledWith({
      where: { id: "client_due" },
      select: {
        deidentifiedAt: true,
        accountDeletionRequestedAt: true,
        accountDeletionFinalizeAt: true,
      },
    });
    expect(mockDeidentifyClientAccount).toHaveBeenCalledWith("client_due");
  });

  it("does not finalize trainer deletion before grace expiration", async () => {
    mockTrainerFindUnique.mockResolvedValueOnce({
      deidentifiedAt: null,
      accountDeletionRequestedAt: new Date(Date.now() - 5_000),
      accountDeletionFinalizeAt: new Date(Date.now() + 60_000),
    });

    await expect(
      finalizeScheduledDeletionIfOverdue({
        role: "trainer",
        id: "trainer_not_due",
      }),
    ).resolves.toBe(false);
    expect(mockTrainerFindUnique).toHaveBeenCalledWith({
      where: { id: "trainer_not_due" },
      select: {
        deidentifiedAt: true,
        accountDeletionRequestedAt: true,
        accountDeletionFinalizeAt: true,
      },
    });
    expect(mockDeidentifyTrainerAccount).not.toHaveBeenCalled();
  });

  it("finalizes all due account deletions and returns summary counts", async () => {
    const now = new Date("2026-05-23T00:00:00.000Z");
    mockClientFindMany.mockResolvedValueOnce([{ id: "client_a" }, { id: "client_b" }]);
    mockTrainerFindMany.mockResolvedValueOnce([{ id: "trainer_a" }]);

    await expect(finalizeDueAccountDeletions(now)).resolves.toEqual({
      clientsFinalized: 2,
      trainersFinalized: 1,
    });

    expect(mockClientFindMany).toHaveBeenCalledWith({
      where: {
        deidentifiedAt: null,
        accountDeletionFinalizeAt: { lte: now },
      },
      select: { id: true },
    });
    expect(mockTrainerFindMany).toHaveBeenCalledWith({
      where: {
        deidentifiedAt: null,
        accountDeletionFinalizeAt: { lte: now },
      },
      select: { id: true },
    });
    expect(mockDeidentifyClientAccount).toHaveBeenNthCalledWith(1, "client_a");
    expect(mockDeidentifyClientAccount).toHaveBeenNthCalledWith(2, "client_b");
    expect(mockDeidentifyTrainerAccount).toHaveBeenCalledWith("trainer_a");
  });
});
