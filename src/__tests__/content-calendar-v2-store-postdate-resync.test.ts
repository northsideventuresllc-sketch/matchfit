import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression test for the 2026-08-13 post_date/day_index desync bug: when
// resolveUniqueDayIndex bumps a post to a different day than the caller planned for (its
// preferred day_index was already taken in that week), post_date must move with it instead of
// staying stamped for the originally-requested day. Proven live during a weekly-generate
// backfill for week 2026-08-10: posts landed with day_index 3/4 (Thu/Fri) but post_date stuck
// at 2026-08-10 (the week's Monday), so the admin calendar showed them on the wrong day.

const { mockCreateNiBrainClient, mockInsertGeneratedCalendarRow } = vi.hoisted(() => ({
  mockCreateNiBrainClient: vi.fn(),
  mockInsertGeneratedCalendarRow: vi.fn(async (args: { row: Record<string, unknown> }) => args.row),
}));

vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: mockCreateNiBrainClient,
}));

vi.mock("@/lib/content-calendar/post-group", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content-calendar/post-group")>(
    "@/lib/content-calendar/post-group",
  );
  return { ...actual, insertGeneratedCalendarRow: mockInsertGeneratedCalendarRow };
});

import { createV2Draft } from "@/lib/content-calendar/content-calendar-v2-store";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createV2Draft post_date / day_index sync", () => {
  it("recomputes post_date from the RESOLVED day_index when the preferred slot was taken", async () => {
    // day_index 0 and 1 are already used for "Static" in this week -> preferredDayIndex 0 must
    // bump to day_index 2.
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      eq: () => builder,
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: [{ day_index: 0 }, { day_index: 1 }], error: null }),
    });
    mockCreateNiBrainClient.mockReturnValue({ from: () => builder });

    await createV2Draft({
      draft: {
        postType: "Static",
        targetGroup: "Clients",
        caption: "test",
        visualPrompt: "test",
        dayIndex: 0, // caller planned this for Monday of the week...
        postDate: "2026-08-10", // ...and stamped Monday's date accordingly.
      } as never,
      weekStart: "2026-08-10",
      lane: "scheduled",
      adminId: "test",
      postDate: "2026-08-10",
      generateMedia: false,
    });

    expect(mockInsertGeneratedCalendarRow).toHaveBeenCalledTimes(1);
    const insertedRow = mockInsertGeneratedCalendarRow.mock.calls[0][0].row;
    // Bumped to day_index 2 (Wednesday) -> post_date must be 2026-08-12, not the original
    // Monday (2026-08-10) the caller asked for.
    expect(insertedRow.day_index).toBe(2);
    expect(insertedRow.post_date).toBe("2026-08-12");
  });

  it("keeps the caller's post_date when the preferred day_index was open (no reassignment)", async () => {
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: () => builder,
      eq: () => builder,
      then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
    });
    mockCreateNiBrainClient.mockReturnValue({ from: () => builder });

    await createV2Draft({
      draft: {
        postType: "Static",
        targetGroup: "Clients",
        caption: "test",
        visualPrompt: "test",
        dayIndex: 3,
        postDate: "2026-08-13",
      } as never,
      weekStart: "2026-08-10",
      lane: "scheduled",
      adminId: "test",
      postDate: "2026-08-13",
      generateMedia: false,
    });

    const insertedRow = mockInsertGeneratedCalendarRow.mock.calls[0][0].row;
    expect(insertedRow.day_index).toBe(3);
    expect(insertedRow.post_date).toBe("2026-08-13");
  });
});
