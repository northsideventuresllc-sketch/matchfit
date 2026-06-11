import { beforeEach, describe, expect, it, vi } from "vitest";

function mockQueryResult(data: { day_index: number }[]) {
  const terminal = Promise.resolve({ data, error: null });
  const secondEq = vi.fn(() => terminal);
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const select = vi.fn(() => ({ eq: firstEq }));
  const from = vi.fn(() => ({ select }));
  return { from, select, firstEq, secondEq };
}

let query = mockQueryResult([]);

vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: () => ({
    from: (...args: unknown[]) => query.from(...args),
  }),
}));

import { resolveUniqueHubDayIndex } from "@/lib/content-calendar/content-calendar-store";

describe("resolveUniqueHubDayIndex", () => {
  beforeEach(() => {
    query = mockQueryResult([]);
  });

  it("returns preferred day index when unused", async () => {
    query = mockQueryResult([{ day_index: 1 }]);

    await expect(
      resolveUniqueHubDayIndex({
        weekStart: "2026-06-09",
        postType: "Video",
        preferredDayIndex: 0,
      }),
    ).resolves.toBe(0);
  });

  it("returns next free day index when preferred slot is taken", async () => {
    query = mockQueryResult([{ day_index: 0 }, { day_index: 1 }]);

    await expect(
      resolveUniqueHubDayIndex({
        weekStart: "2026-06-09",
        postType: "Video",
        preferredDayIndex: 0,
      }),
    ).resolves.toBe(2);
  });
});
