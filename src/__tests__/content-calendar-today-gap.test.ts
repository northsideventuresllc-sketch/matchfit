import { beforeEach, describe, expect, it, vi } from "vitest";

// WF1.01 fix: a catch-up session can build yesterday and queue tomorrow while silently
// skipping today. findTodaysMissingPostTypes() is the assertion that stops that gap from
// going unnoticed — it must report exactly which of that weekday's locked post types
// (CONTENT_CALENDAR_WEEKDAY_POST_TYPES, Decision #1571) are missing, never silently pass on
// a partial day.

const { mockCreateNiBrainClient } = vi.hoisted(() => ({
  mockCreateNiBrainClient: vi.fn(),
}));

vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: mockCreateNiBrainClient,
}));

import { findTodaysMissingPostTypes } from "@/lib/content-calendar/content-calendar-v2-store";

beforeEach(() => {
  vi.clearAllMocks();
});

function mockRows(rows: { post_type: string }[]) {
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
  });
  mockCreateNiBrainClient.mockReturnValue({ from: () => builder });
}

describe("findTodaysMissingPostTypes", () => {
  it("reports both locked types missing on a static+text day (Tue) when nothing was generated", async () => {
    mockRows([]);
    // 2026-09-01 is a Tuesday — Decision #1571 locks Tue to Static+Text only.
    const missing = await findTodaysMissingPostTypes("2026-09-01");
    expect(missing.sort()).toEqual(["Static", "Text"].sort());
  });

  it("reports both locked types missing on a carousel+video day (Wed) when nothing was generated", async () => {
    mockRows([]);
    // 2026-09-02 is a Wednesday — Decision #1571 locks Wed to Carousel+Video only.
    const missing = await findTodaysMissingPostTypes("2026-09-02");
    expect(missing.sort()).toEqual(["Carousel", "Video"].sort());
  });

  it("does not flag Carousel/Video as missing on a static+text day even when absent", async () => {
    mockRows([{ post_type: "Static" }]);
    const missing = await findTodaysMissingPostTypes("2026-09-01");
    expect(missing).toEqual(["Text"]);
  });

  it("reports nothing missing when the day's locked pair exists", async () => {
    mockRows([{ post_type: "Static" }, { post_type: "Text" }]);
    const missing = await findTodaysMissingPostTypes("2026-09-01");
    expect(missing).toEqual([]);
  });
});
