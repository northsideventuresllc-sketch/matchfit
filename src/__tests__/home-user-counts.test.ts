import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { queryRawMock, betaExcludeCapCountEmailsMock, betaExcludeCapCountUsernamesMock } = vi.hoisted(
  () => ({
    queryRawMock: vi.fn(),
    betaExcludeCapCountEmailsMock: vi.fn<() => Set<string>>(),
    betaExcludeCapCountUsernamesMock: vi.fn<() => Set<string>>(),
  }),
);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

vi.mock("@/lib/beta-launch-config", () => ({
  betaExcludeCapCountEmails: betaExcludeCapCountEmailsMock,
  betaExcludeCapCountUsernames: betaExcludeCapCountUsernamesMock,
}));

import { getHomeUserCounts } from "@/lib/home-user-counts";

function missingInternalQaColumnError() {
  return new Prisma.PrismaClientKnownRequestError(
    'column "internalQaSyntheticPersona" does not exist (42703)',
    { code: "P2010", clientVersion: "unit-test" },
  );
}

describe("getHomeUserCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    betaExcludeCapCountEmailsMock.mockReturnValue(new Set());
    betaExcludeCapCountUsernamesMock.mockReturnValue(new Set());
  });

  it("maps bigint query rows into numeric counters", async () => {
    queryRawMock.mockResolvedValue([
      {
        trainers_total: 11n,
        trainers_pending: 2n,
        trainers_active: 8n,
        clients_total: 22n,
        clients_active: 13n,
      },
    ]);

    await expect(getHomeUserCounts()).resolves.toEqual({
      trainersTotal: 11,
      trainersPending: 2,
      trainersActive: 8,
      clientsTotal: 22,
      clientsActive: 13,
    });
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("returns zeros when the aggregate query yields no row", async () => {
    queryRawMock.mockResolvedValue([]);

    await expect(getHomeUserCounts()).resolves.toEqual({
      trainersTotal: 0,
      trainersPending: 0,
      trainersActive: 0,
      clientsTotal: 0,
      clientsActive: 0,
    });
  });

  it("retries without internalQaSyntheticPersona filter when that column is missing", async () => {
    queryRawMock
      .mockRejectedValueOnce(missingInternalQaColumnError())
      .mockResolvedValueOnce([
        {
          trainers_total: 3n,
          trainers_pending: 1n,
          trainers_active: 2n,
          clients_total: 5n,
          clients_active: 4n,
        },
      ]);

    await expect(getHomeUserCounts()).resolves.toEqual({
      trainersTotal: 3,
      trainersPending: 1,
      trainersActive: 2,
      clientsTotal: 5,
      clientsActive: 4,
    });
    expect(queryRawMock).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-Prisma errors instead of retrying", async () => {
    queryRawMock.mockRejectedValue(new Error("database timeout"));

    await expect(getHomeUserCounts()).rejects.toThrow("database timeout");
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("returns zero counters in development when the database is unavailable", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "development";
      queryRawMock.mockRejectedValue(new Error("Can't reach database server at localhost:5432"));

      await expect(getHomeUserCounts()).resolves.toEqual({
        trainersTotal: 0,
        trainersPending: 0,
        trainersActive: 0,
        clientsTotal: 0,
        clientsActive: 0,
      });
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  });
});
