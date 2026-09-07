import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard for the chained-hops refactor (MF-CONTENT-GEN-VERCEL-504-0907, PR #368).
// Two new/refactored surfaces in daily-generation.ts are covered here:
//   1. getDailyMissingPostTypes() — the cheap, AI-free front half the daily cron route calls to
//      decide how many per-type hops to fan out. Must be a weekend no-op, must expose today's
//      JB-locked pair (Mon/Wed/Fri Carousel+Video, Tue/Thu Static+Text), and must only count LIVE
//      (deleted_at IS NULL) rows as "already filled".
//   2. runDailyContentGeneration({ onlyPostType }) — the new single-type bound each hop runs with.
//      With onlyPostType set, exactly that one type is generated and written, never the pair.

const {
  mockCreateNiBrainClient,
  mockHydratePlatformEnv,
  mockResetContentContextCache,
  mockGetMatchFitDpmoPhase,
  mockResearchTrendingHashtags,
  mockGenerateBulkContent,
  mockBuildMediaGenerationPrompt,
  mockCreateV2Draft,
} = vi.hoisted(() => ({
  mockCreateNiBrainClient: vi.fn(),
  mockHydratePlatformEnv: vi.fn(),
  mockResetContentContextCache: vi.fn(),
  mockGetMatchFitDpmoPhase: vi.fn(),
  mockResearchTrendingHashtags: vi.fn(),
  mockGenerateBulkContent: vi.fn(),
  mockBuildMediaGenerationPrompt: vi.fn(),
  mockCreateV2Draft: vi.fn(),
}));

vi.mock("@/lib/ni-brain-client", () => ({ createNiBrainClient: mockCreateNiBrainClient }));
vi.mock("@/lib/hydrate-platform-env", () => ({ hydratePlatformEnvFromDatabase: mockHydratePlatformEnv }));
vi.mock("@/lib/content-calendar/content-context", () => ({
  resetContentContextCache: mockResetContentContextCache,
  buildContentGenerationContext: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/lib/content-calendar/cowork-jobs", () => ({ getMatchFitDpmoPhase: mockGetMatchFitDpmoPhase }));
vi.mock("@/lib/content-calendar/hashtag-research", () => ({ researchTrendingHashtags: mockResearchTrendingHashtags }));
vi.mock("@/lib/content-calendar/content-calendar-ai", () => ({ generateBulkContent: mockGenerateBulkContent }));
vi.mock("@/lib/content-calendar/content-prompts", () => ({ buildMediaGenerationPrompt: mockBuildMediaGenerationPrompt }));
vi.mock("@/lib/content-calendar/content-calendar-v2-store", () => ({ createV2Draft: mockCreateV2Draft }));

import { getDailyMissingPostTypes, runDailyContentGeneration } from "@/lib/content-calendar/daily-generation";

// 2026-08-31 = Monday (weekStart for the whole week below).
// 2026-09-01 = Tuesday (dayIndex 1, locked pair Static+Text).
// 2026-09-02 = Wednesday (dayIndex 2, locked pair Carousel+Video).
// 2026-09-05 = Saturday (weekend, no-op).
const WEEK_START = "2026-08-31";
const TUESDAY = "2026-09-01";
const WEDNESDAY = "2026-09-02";
const SATURDAY = "2026-09-05";

/** Mocks the LIVE existing-slot lookup and returns the `is` spy so tests can prove the
 * `deleted_at IS NULL` filter (the 2026-08-31 resolveUniqueDayIndex fix) was actually applied. */
function mockExistingPostTypes(postTypes: string[]) {
  const builder: Record<string, unknown> = {};
  const isSpy = vi.fn(() => builder);
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    is: isSpy,
    then: (resolve: (v: unknown) => void) =>
      resolve({ data: postTypes.map((post_type) => ({ post_type })), error: null }),
  });
  mockCreateNiBrainClient.mockReturnValue({ from: () => builder });
  return isSpy;
}

function draft(postType: string, postDate: string, dayIndex: number) {
  return {
    tempId: `t_${postType}`,
    postType,
    targetGroup: "Join the Team",
    platforms: "Instagram,Threads,Facebook",
    postDate,
    dayIndex,
    caption: `${postType} caption`,
    visualPrompt: postType === "Text" ? null : `${postType} visual`,
    hashtags: ["fitness"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHydratePlatformEnv.mockResolvedValue(undefined);
  mockGetMatchFitDpmoPhase.mockResolvedValue(null);
  mockResearchTrendingHashtags.mockResolvedValue({
    researchedAt: "2026-09-01T00:00:00.000Z",
    usedWebSearch: true,
    provider: "axon-local",
    hashtags: ["fitness", "personaltrainer"],
    trends: ["online coaching demand up"],
    notes: null,
  });
  mockBuildMediaGenerationPrompt.mockReturnValue("built visual prompt");
  mockCreateV2Draft.mockResolvedValue({ id: "post_1" });
});

describe("getDailyMissingPostTypes", () => {
  it("is a no-op on a weekend and never queries the database", async () => {
    const slot = await getDailyMissingPostTypes({ date: SATURDAY });

    expect(slot.ran).toBe(false);
    if (!slot.ran) expect(slot.reason).toMatch(/weekend/i);
    expect(mockCreateNiBrainClient).not.toHaveBeenCalled();
  });

  it("returns Tuesday's locked pair (Static+Text) with everything missing when the slot is empty", async () => {
    const isSpy = mockExistingPostTypes([]);

    const slot = await getDailyMissingPostTypes({ date: TUESDAY });

    expect(slot.ran).toBe(true);
    if (slot.ran) {
      expect(slot.dayIndex).toBe(1);
      expect(slot.weekStart).toBe(WEEK_START);
      expect(slot.postDate).toBe(TUESDAY);
      expect([...slot.dayFormats]).toEqual(["Static", "Text"]);
      expect(slot.missingPostTypes).toEqual(["Static", "Text"]);
    }
    // Proves the existing-slot lookup excludes soft-deleted rows, not just that a query ran.
    expect(isSpy).toHaveBeenCalledWith("deleted_at", null);
  });

  it("returns only the still-missing half of Wednesday's locked pair (Carousel exists → Video missing)", async () => {
    mockExistingPostTypes(["Carousel"]);

    const slot = await getDailyMissingPostTypes({ date: WEDNESDAY });

    expect(slot.ran).toBe(true);
    if (slot.ran) {
      expect(slot.dayIndex).toBe(2);
      expect([...slot.dayFormats]).toEqual(["Carousel", "Video"]);
      expect(slot.missingPostTypes).toEqual(["Video"]);
    }
  });

  it("returns an empty missing list when Wednesday's full pair already exists", async () => {
    mockExistingPostTypes(["Carousel", "Video"]);

    const slot = await getDailyMissingPostTypes({ date: WEDNESDAY });

    expect(slot.ran).toBe(true);
    if (slot.ran) expect(slot.missingPostTypes).toEqual([]);
  });
});

describe("runDailyContentGeneration({ onlyPostType })", () => {
  it("generates and writes exactly the one bounded post type, never the whole pair", async () => {
    // Wednesday, both Carousel+Video missing, but this hop is bounded to Video only.
    mockExistingPostTypes([]);
    mockGenerateBulkContent.mockResolvedValue({ drafts: [draft("Video", WEDNESDAY, 2)], meta: {} });

    const result = await runDailyContentGeneration({ date: WEDNESDAY, onlyPostType: "Video" });

    expect(result.ran).toBe(true);
    if (result.ran) expect(result.createdPostTypes).toEqual(["Video"]);

    // The AI vault was asked for Video and nothing else — Carousel never entered this hop.
    expect(mockGenerateBulkContent).toHaveBeenCalledTimes(1);
    const items = mockGenerateBulkContent.mock.calls[0][0].items as { postType: string }[];
    expect(items.map((i) => i.postType)).toEqual(["Video"]);

    // Exactly one draft written, for Video, still inside the approve-only rule.
    expect(mockCreateV2Draft).toHaveBeenCalledTimes(1);
    expect(mockCreateV2Draft.mock.calls[0][0].draft.postType).toBe("Video");
    expect(mockCreateV2Draft.mock.calls[0][0].lane).toBe("scheduled");
    expect(mockCreateV2Draft.mock.calls[0][0].generateMedia).toBe(false);
    expect(mockCreateV2Draft.mock.calls.some((call) => call[0].draft.postType === "Carousel")).toBe(false);
  });

  it("does nothing when the bounded post type is already present (idempotent hop)", async () => {
    // Wednesday: Carousel already exists; a hop bounded to Carousel has nothing to do.
    mockExistingPostTypes(["Carousel"]);

    const result = await runDailyContentGeneration({ date: WEDNESDAY, onlyPostType: "Carousel" });

    expect(result.ran).toBe(true);
    if (result.ran) expect(result.createdPostTypes).toEqual([]);
    expect(mockGenerateBulkContent).not.toHaveBeenCalled();
    expect(mockCreateV2Draft).not.toHaveBeenCalled();
  });
});
