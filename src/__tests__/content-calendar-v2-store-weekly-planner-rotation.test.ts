import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression test for MF-CONTENT-ROTATION-MISMATCH-0904: generateWeeklyPlannerDay (the admin
// "weekly planner" single-day generation action, driven by POST
// /api/admin/content-calendar/v2/weekly) was a third producer of per-day Content Hub drafts that
// still generated all four CONTENT_CALENDAR_POST_TYPES (Carousel, Static, Video, Text) for every
// weekday, ignoring the JB-locked CONTENT_CALENDAR_WEEKDAY_POST_TYPES rotation
// (Mon/Wed/Fri = Carousel+Video, Tue/Thu = Static+Text) that weekly-generation.ts and
// daily-generation.ts already enforce. That is what actually produced the mismatched rows for
// 2026-09-01..09-03 (weekly-generation.ts's timestamps don't match those rows).

const { mockCreateNiBrainClient, mockInsertGeneratedCalendarRow, mockGenerateBulkContent, mockQueueMiniChromeAgentJob } =
  vi.hoisted(() => ({
    mockCreateNiBrainClient: vi.fn(),
    mockInsertGeneratedCalendarRow: vi.fn(async (args: { row: Record<string, unknown> }) => ({
      id: `row-${args.row.post_type}`,
      ...args.row,
    })),
    mockGenerateBulkContent: vi.fn(),
    mockQueueMiniChromeAgentJob: vi.fn(async () => undefined),
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

vi.mock("@/lib/content-calendar/content-calendar-ai", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content-calendar/content-calendar-ai")>(
    "@/lib/content-calendar/content-calendar-ai",
  );
  return { ...actual, generateBulkContent: mockGenerateBulkContent };
});

vi.mock("@/lib/content-calendar/cowork-jobs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/content-calendar/cowork-jobs")>(
    "@/lib/content-calendar/cowork-jobs",
  );
  return { ...actual, queueMiniChromeAgentJob: mockQueueMiniChromeAgentJob };
});

import { generateWeeklyPlannerDay } from "@/lib/content-calendar/content-calendar-v2-store";
import { CONTENT_CALENDAR_POST_TYPES, type ContentCalendarPostType } from "@/lib/content-calendar/constants";

function stubNoExistingRows() {
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
  });
  mockCreateNiBrainClient.mockReturnValue({ from: () => builder });
}

const allFourPrompts: Record<ContentCalendarPostType, string> = {
  Carousel: "carousel prompt",
  Static: "static prompt",
  Video: "video prompt",
  Text: "text prompt",
};

beforeEach(() => {
  vi.clearAllMocks();
  stubNoExistingRows();
  mockGenerateBulkContent.mockImplementation(async (args: { items: { postType: ContentCalendarPostType }[] }) => ({
    drafts: args.items.map((item) => ({
      postType: item.postType,
      targetGroup: "Clients",
      caption: `${item.postType} caption`,
      visualPrompt: `${item.postType} visual`,
    })),
  }));
});

describe("generateWeeklyPlannerDay weekday rotation", () => {
  it("Tuesday (dayIndex 1) generates exactly Static + Text, never Carousel/Video", async () => {
    const rows = await generateWeeklyPlannerDay({
      weekStart: "2026-09-07",
      dayIndex: 1, // Tue
      theme: "theme",
      targetAudience: "Clients",
      cta: "cta",
      prompts: allFourPrompts,
      adminId: "admin-1",
    });

    const createdTypes = rows.map((r) => r.post_type).sort();
    expect(createdTypes).toEqual(["Static", "Text"]);
    expect(createdTypes).not.toContain("Carousel");
    expect(createdTypes).not.toContain("Video");

    const requestedTypes = mockGenerateBulkContent.mock.calls[0][0].items.map(
      (i: { postType: ContentCalendarPostType }) => i.postType,
    );
    expect(requestedTypes.sort()).toEqual(["Static", "Text"]);
  });

  it("Wednesday (dayIndex 2) generates exactly Carousel + Video, never Static/Text", async () => {
    const rows = await generateWeeklyPlannerDay({
      weekStart: "2026-09-07",
      dayIndex: 2, // Wed
      theme: "theme",
      targetAudience: "Clients",
      cta: "cta",
      prompts: allFourPrompts,
      adminId: "admin-1",
    });

    const createdTypes = rows.map((r) => r.post_type).sort();
    expect(createdTypes).toEqual(["Carousel", "Video"]);
    expect(createdTypes).not.toContain("Static");
    expect(createdTypes).not.toContain("Text");

    const requestedTypes = mockGenerateBulkContent.mock.calls[0][0].items.map(
      (i: { postType: ContentCalendarPostType }) => i.postType,
    );
    expect(requestedTypes.sort()).toEqual(["Carousel", "Video"]);
  });

  it("never requests all four CONTENT_CALENDAR_POST_TYPES for a single weekday", async () => {
    await generateWeeklyPlannerDay({
      weekStart: "2026-09-07",
      dayIndex: 2, // Wed
      theme: "theme",
      targetAudience: "Clients",
      cta: "cta",
      prompts: allFourPrompts,
      adminId: "admin-1",
    });

    const requestedTypes: ContentCalendarPostType[] = mockGenerateBulkContent.mock.calls[0][0].items.map(
      (i: { postType: ContentCalendarPostType }) => i.postType,
    );
    expect(requestedTypes.length).toBeLessThan(CONTENT_CALENDAR_POST_TYPES.length);
  });
});
