import { beforeEach, describe, expect, it, vi } from "vitest";

// WF1.01 fix: a catch-up session can build yesterday and queue tomorrow while silently
// skipping today. findTodaysMissingPostTypes() is the assertion that stops that gap from
// going unnoticed — it must report exactly which of the four post types are missing for a
// given date, never silently pass on a partial day.

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
  it("reports all four types missing when nothing was generated for today", async () => {
    mockRows([]);
    const missing = await findTodaysMissingPostTypes("2026-09-01");
    expect(missing.sort()).toEqual(["Carousel", "Static", "Text", "Video"].sort());
  });

  it("reports only the types not present for today", async () => {
    mockRows([{ post_type: "Static" }, { post_type: "Video" }]);
    const missing = await findTodaysMissingPostTypes("2026-09-01");
    expect(missing.sort()).toEqual(["Carousel", "Text"].sort());
  });

  it("reports nothing missing when the full four-pack exists", async () => {
    mockRows([
      { post_type: "Static" },
      { post_type: "Video" },
      { post_type: "Carousel" },
      { post_type: "Text" },
    ]);
    const missing = await findTodaysMissingPostTypes("2026-09-01");
    expect(missing).toEqual([]);
  });
});
