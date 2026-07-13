import { beforeEach, describe, expect, it, vi } from "vitest";

function mockQueryResult(data: { day_index: number }[]) {
  const terminal = Promise.resolve({ data, error: null });
  const secondEq = vi.fn(() => terminal);
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const select = vi.fn(() => ({ eq: firstEq }));
  const from = vi.fn(() => ({ select }));
  return { from, select, firstEq, secondEq };
}

const insertSingle = vi.fn();
let query = mockQueryResult([]);

vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: () => ({
    from: (...args: unknown[]) => {
      const tableOps = query.from(...args);
      return {
        ...tableOps,
        insert: (row: unknown) => ({
          select: () => ({
            single: () => insertSingle(row),
          }),
        }),
      };
    },
  }),
}));

import { resolveUniqueHubDayIndex, saveDraftToHub } from "@/lib/content-calendar/content-calendar-store";

describe("resolveUniqueHubDayIndex", () => {
  beforeEach(() => {
    query = mockQueryResult([]);
    insertSingle.mockReset();
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

describe("saveDraftToHub", () => {
  beforeEach(() => {
    query = mockQueryResult([]);
    insertSingle.mockReset();
    insertSingle.mockImplementation((row: Record<string, unknown>) =>
      Promise.resolve({ data: { id: "post_1", ...row }, error: null }),
    );
  });

  it("stores null post_date for unscheduled drafts instead of an empty string", async () => {
    const row = await saveDraftToHub({
      draft: {
        tempId: "draft_1",
        dayIndex: 0,
        postType: "Carousel",
        targetGroup: "Join the Team",
        platforms: "Instagram",
        caption: "Caption",
        visualPrompt: null,
        hashtags: ["MatchFit"],
        postDate: null,
      },
      weekStart: "2026-06-09",
      scheduled: false,
      adminId: "admin_1",
      bulkSessionId: "bulk_1",
    });

    expect(insertSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        post_date: null,
        is_scheduled: false,
      }),
    );
    expect(row.post_date).toBeNull();
  });
});
