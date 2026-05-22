import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHomeUserCounts } from "@/lib/home-user-counts";

const queryRawMock = vi.fn();

class MockKnownRequestError extends Error {}

vi.mock("@/generated/prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: MockKnownRequestError,
    empty: { __kind: "empty" as const },
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      __kind: "sql" as const,
      strings: [...strings],
      values,
    }),
    join: (values: unknown[]) => ({
      __kind: "join" as const,
      values,
    }),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

function collectStringValues(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, out);
    }
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStringValues(item, out);
    }
  }
  return out;
}

describe("getHomeUserCounts", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("maps bigint query results to numeric counters", async () => {
    queryRawMock.mockResolvedValue([
      {
        trainers_total: 11n,
        trainers_active: 4n,
        clients_total: 21n,
        clients_active: 17n,
      },
    ]);

    await expect(getHomeUserCounts()).resolves.toEqual({
      trainersTotal: 11,
      trainersActive: 4,
      clientsTotal: 21,
      clientsActive: 17,
    });
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("returns zeroed counters when query returns no row", async () => {
    queryRawMock.mockResolvedValue([]);

    await expect(getHomeUserCounts()).resolves.toEqual({
      trainersTotal: 0,
      trainersActive: 0,
      clientsTotal: 0,
      clientsActive: 0,
    });
  });

  it("retries without synthetic persona clause on missing-column errors", async () => {
    const { Prisma } = await import("@/generated/prisma/client");
    queryRawMock
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError(
          'column "internalQaSyntheticPersona" does not exist (42703)',
        ),
      )
      .mockResolvedValueOnce([
        {
          trainers_total: 8n,
          trainers_active: 2n,
          clients_total: 9n,
          clients_active: 3n,
        },
      ]);

    await expect(getHomeUserCounts()).resolves.toEqual({
      trainersTotal: 8,
      trainersActive: 2,
      clientsTotal: 9,
      clientsActive: 3,
    });
    expect(queryRawMock).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-column errors", async () => {
    const error = new Error("database unavailable");
    queryRawMock.mockRejectedValue(error);

    await expect(getHomeUserCounts()).rejects.toThrow("database unavailable");
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes excluded emails to lowercase before building SQL clauses", async () => {
    process.env.MATCH_FIT_BETA_EXCLUDE_CAP_COUNT_EMAILS = "Staff@MatchFit.com, QA+ONE@Example.com";
    queryRawMock.mockResolvedValue([
      {
        trainers_total: 1n,
        trainers_active: 1n,
        clients_total: 1n,
        clients_active: 1n,
      },
    ]);

    await getHomeUserCounts();

    expect(queryRawMock).toHaveBeenCalledTimes(1);
    const args = queryRawMock.mock.calls[0] ?? [];
    const allStringValues = collectStringValues(args);
    expect(allStringValues).toContain("staff@matchfit.com");
    expect(allStringValues).toContain("qa+one@example.com");
  });
});
