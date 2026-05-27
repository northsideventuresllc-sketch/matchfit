import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockClientUpdate,
  mockTrainerUpdate,
  mockClientFindUnique,
  mockTrainerFindUnique,
  mockClientFindMany,
  mockTrainerFindMany,
  mockDeidentifyClientAccount,
  mockDeidentifyTrainerAccount,
} = vi.hoisted(() => ({
  mockClientUpdate: vi.fn(),
  mockTrainerUpdate: vi.fn(),
  mockClientFindUnique: vi.fn(),
  mockTrainerFindUnique: vi.fn(),
  mockClientFindMany: vi.fn(),
  mockTrainerFindMany: vi.fn(),
  mockDeidentifyClientAccount: vi.fn(),
  mockDeidentifyTrainerAccount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: {
      update: mockClientUpdate,
      findUnique: mockClientFindUnique,
      findMany: mockClientFindMany,
    },
    trainer: {
      update: mockTrainerUpdate,
      findUnique: mockTrainerFindUnique,
      findMany: mockTrainerFindMany,
    },
  },
}));

vi.mock("@/lib/account-deletion", () => ({
  deidentifyClientAccount: mockDeidentifyClientAccount,
  deidentifyTrainerAccount: mockDeidentifyTrainerAccount,
}));

import {
  accountDeletionGraceMs,
  cancelScheduledClientAccountDeletion,
  cancelScheduledTrainerAccountDeletion,
  finalizeDueAccountDeletions,
  finalizeScheduledDeletionIfOverdue,
  scheduleClientAccountDeletion,
  scheduleTrainerAccountDeletion,
} from "@/lib/account-deletion-grace";

describe("account-deletion-grace async operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules client deletion and stores a 30-day finalize timestamp", async () => {
    mockClientUpdate.mockResolvedValueOnce({});

    const finalizeAt = await scheduleClientAccountDeletion("client_1");

    expect(mockClientUpdate).toHaveBeenCalledTimes(1);
    const args = mockClientUpdate.mock.calls[0][0] as {
      data: { accountDeletionRequestedAt: Date; accountDeletionFinalizeAt: Date; allowTrainerDiscovery: boolean };
    };
    expect(args.data.allowTrainerDiscovery).toBe(false);
    expect(args.data.accountDeletionFinalizeAt.getTime() - args.data.accountDeletionRequestedAt.getTime()).toBe(
      accountDeletionGraceMs(),
    );
    expect(finalizeAt.toISOString()).toBe(args.data.accountDeletionFinalizeAt.toISOString());
  });

  it("schedules trainer deletion with requested/finalize timestamps", async () => {
    mockTrainerUpdate.mockResolvedValueOnce({});

    const finalizeAt = await scheduleTrainerAccountDeletion("trainer_1");

    expect(mockTrainerUpdate).toHaveBeenCalledTimes(1);
    const args = mockTrainerUpdate.mock.calls[0][0] as {
      data: { accountDeletionRequestedAt: Date; accountDeletionFinalizeAt: Date };
    };
    expect(args.data.accountDeletionRequestedAt).toBeInstanceOf(Date);
    expect(args.data.accountDeletionFinalizeAt).toBeInstanceOf(Date);
    expect(finalizeAt.toISOString()).toBe(args.data.accountDeletionFinalizeAt.toISOString());
  });

  it("cancels client deletion during active grace period", async () => {
    mockClientFindUnique.mockResolvedValueOnce({
      deidentifiedAt: null,
      accountDeletionRequestedAt: new Date("2026-05-22T00:00:00.000Z"),
      accountDeletionFinalizeAt: new Date("2026-05-24T00:00:00.000Z"),
    });
    mockClientUpdate.mockResolvedValueOnce({});

    await expect(cancelScheduledClientAccountDeletion("client_1")).resolves.toBe(true);
    expect(mockClientUpdate).toHaveBeenCalledWith({
      where: { id: "client_1" },
      data: {
        accountDeletionRequestedAt: null,
        accountDeletionFinalizeAt: null,
      },
    });
  });

  it("does not cancel client deletion when account is missing or grace is inactive", async () => {
    mockClientFindUnique.mockResolvedValueOnce(null);
    await expect(cancelScheduledClientAccountDeletion("missing")).resolves.toBe(false);

    mockClientFindUnique.mockResolvedValueOnce({
      deidentifiedAt: null,
      accountDeletionRequestedAt: new Date("2026-05-20T00:00:00.000Z"),
      accountDeletionFinalizeAt: new Date("2026-05-21T00:00:00.000Z"),
    });
    await expect(cancelScheduledClientAccountDeletion("expired")).resolves.toBe(false);
    expect(mockClientUpdate).not.toHaveBeenCalled();
  });

  it("cancels trainer deletion only while grace is active", async () => {
    mockTrainerFindUnique.mockResolvedValueOnce({
      deidentifiedAt: null,
      accountDeletionRequestedAt: new Date("2026-05-22T00:00:00.000Z"),
      accountDeletionFinalizeAt: new Date("2026-05-24T00:00:00.000Z"),
    });
    mockTrainerUpdate.mockResolvedValueOnce({});
    await expect(cancelScheduledTrainerAccountDeletion("trainer_active")).resolves.toBe(true);

    mockTrainerFindUnique.mockResolvedValueOnce({
      deidentifiedAt: new Date("2026-05-22T12:00:00.000Z"),
      accountDeletionRequestedAt: new Date("2026-05-22T00:00:00.000Z"),
      accountDeletionFinalizeAt: new Date("2026-05-24T00:00:00.000Z"),
    });
    await expect(cancelScheduledTrainerAccountDeletion("trainer_deidentified")).resolves.toBe(false);
  });

  it("finalizes overdue client deletion on login guard", async () => {
    mockClientFindUnique.mockResolvedValueOnce({
      deidentifiedAt: null,
      accountDeletionRequestedAt: new Date("2026-05-20T00:00:00.000Z"),
      accountDeletionFinalizeAt: new Date("2026-05-21T00:00:00.000Z"),
    });
    mockDeidentifyClientAccount.mockResolvedValueOnce(undefined);

    await expect(
      finalizeScheduledDeletionIfOverdue({
        role: "client",
        id: "client_overdue",
      }),
    ).resolves.toBe(true);
    expect(mockDeidentifyClientAccount).toHaveBeenCalledWith("client_overdue");
  });

  it("does not finalize trainer deletion when not overdue", async () => {
    mockTrainerFindUnique.mockResolvedValueOnce({
      deidentifiedAt: null,
      accountDeletionRequestedAt: new Date("2026-05-22T00:00:00.000Z"),
      accountDeletionFinalizeAt: new Date("2026-05-24T00:00:00.000Z"),
    });

    await expect(
      finalizeScheduledDeletionIfOverdue({
        role: "trainer",
        id: "trainer_not_overdue",
      }),
    ).resolves.toBe(false);
    expect(mockDeidentifyTrainerAccount).not.toHaveBeenCalled();
  });

  it("finalizes due client and trainer rows from the cron helper", async () => {
    mockClientFindMany.mockResolvedValueOnce([{ id: "c1" }, { id: "c2" }]);
    mockTrainerFindMany.mockResolvedValueOnce([{ id: "t1" }]);
    mockDeidentifyClientAccount.mockResolvedValue(undefined);
    mockDeidentifyTrainerAccount.mockResolvedValue(undefined);

    await expect(finalizeDueAccountDeletions(new Date("2026-05-23T00:00:00.000Z"))).resolves.toEqual({
      clientsFinalized: 2,
      trainersFinalized: 1,
    });
    expect(mockDeidentifyClientAccount).toHaveBeenCalledTimes(2);
    expect(mockDeidentifyClientAccount).toHaveBeenNthCalledWith(1, "c1");
    expect(mockDeidentifyClientAccount).toHaveBeenNthCalledWith(2, "c2");
    expect(mockDeidentifyTrainerAccount).toHaveBeenCalledWith("t1");
  });
});
