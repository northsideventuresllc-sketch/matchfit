import { beforeEach, describe, expect, it, vi } from "vitest";

// Coverage for the daily Content Hub top-up (daily-generation.ts): the "AXON agents do the
// research and push it to the MF portal every day" pipeline. What matters most:
// (1) it never runs on a weekend (Match Fit's calendar is Monday-Friday only), (2) it targets
// ONLY the JB-locked post-type pair for that weekday (Mon/Wed/Fri: Carousel+Video, Tue/Thu:
// Static+Text) -- never the other pair, since reproducing the exact bug fixed 2026-09-01 in the
// weekly job would be a real regression here, (3) it never re-generates a post type already
// sitting in the Hub (idempotent, no over-generation), and (4) a missing AI response is skipped,
// never guessed at positionally.

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
  mockHydratePlatformEnv: vi.fn().mockResolvedValue(undefined),
  mockResetContentContextCache: vi.fn(),
  mockGetMatchFitDpmoPhase: vi.fn().mockResolvedValue(null),
  mockResearchTrendingHashtags: vi.fn().mockResolvedValue({
    researchedAt: "2026-09-01T00:00:00.000Z",
    usedWebSearch: true,
    provider: "axon-local",
    hashtags: ["fitness", "personaltrainer"],
    trends: ["online coaching demand up"],
    notes: null,
  }),
  mockGenerateBulkContent: vi.fn(),
  mockBuildMediaGenerationPrompt: vi.fn().mockReturnValue("built visual prompt"),
  mockCreateV2Draft: vi.fn().mockResolvedValue({ id: "post_1" }),
}));

vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: mockCreateNiBrainClient,
}));
vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: mockHydratePlatformEnv,
}));
vi.mock("@/lib/content-calendar/content-context", () => ({
  resetContentContextCache: mockResetContentContextCache,
  buildContentGenerationContext: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/lib/content-calendar/cowork-jobs", () => ({
  getMatchFitDpmoPhase: mockGetMatchFitDpmoPhase,
}));
vi.mock("@/lib/content-calendar/hashtag-research", () => ({
  researchTrendingHashtags: mockResearchTrendingHashtags,
}));
vi.mock("@/lib/content-calendar/content-calendar-ai", () => ({
  generateBulkContent: mockGenerateBulkContent,
}));
vi.mock("@/lib/content-calendar/content-prompts", () => ({
  buildMediaGenerationPrompt: mockBuildMediaGenerationPrompt,
}));
vi.mock("@/lib/content-calendar/content-calendar-v2-store", () => ({
  createV2Draft: mockCreateV2Draft,
}));

import { runDailyContentGeneration } from "@/lib/content-calendar/daily-generation";
import { CONTENT_CALENDAR_WEEKDAY_POST_TYPES } from "@/lib/content-calendar/constants";

// 2026-09-01 = Tuesday (dayIndex 1, locked pair Static+Text).
// 2026-09-02 = Wednesday (dayIndex 2, locked pair Carousel+Video).
// 2026-09-05 = Saturday (weekend, no-op).
const TUESDAY = "2026-09-01";
const WEDNESDAY = "2026-09-02";
const SATURDAY = "2026-09-05";

function mockExistingPostTypes(postTypes: string[]) {
  const builder: Record<string, unknown> = {};
  // `is` is a real vi.fn (not a passthrough no-op) so tests can assert it was actually invoked
  // with ("deleted_at", null) — the exact filter the 2026-08-31 resolveUniqueDayIndex fix added,
  // proving this query excludes archived/scrapped rows from counting as "already filled".
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
  mockCreateV2Draft.mockResolvedValue({ id: "post_1" });
});

describe("runDailyContentGeneration", () => {
  it("does not run on a weekend and never touches the database or AI vault", async () => {
    const result = await runDailyContentGeneration({ date: SATURDAY });

    expect(result.ran).toBe(false);
    expect(mockCreateNiBrainClient).not.toHaveBeenCalled();
    expect(mockGenerateBulkContent).not.toHaveBeenCalled();
    expect(mockCreateV2Draft).not.toHaveBeenCalled();
  });

  it("targets only today's JB-locked post-type pair, never the other weekday's pair", async () => {
    // Tuesday's locked pair is Static+Text. Nothing exists yet for today.
    mockExistingPostTypes([]);
    mockGenerateBulkContent.mockResolvedValue({
      drafts: [
        {
          tempId: "t1",
          postType: "Static",
          targetGroup: "Join the Team",
          platforms: "Instagram,Threads,Facebook",
          postDate: TUESDAY,
          dayIndex: 1,
          caption: "Static caption",
          visualPrompt: "static visual",
          hashtags: ["fitness"],
        },
        {
          tempId: "t2",
          postType: "Text",
          targetGroup: "Join the Team",
          platforms: "Threads,Facebook",
          postDate: TUESDAY,
          dayIndex: 1,
          caption: "Text caption",
          visualPrompt: null,
          hashtags: ["fitness"],
        },
      ],
      meta: {},
    });

    const result = await runDailyContentGeneration({ date: TUESDAY });

    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.createdPostTypes.sort()).toEqual(["Static", "Text"]);
    }
    // Never asked the AI vault for Carousel or Video on a Tuesday — that's Mon/Wed/Fri's pair.
    const items = mockGenerateBulkContent.mock.calls[0][0].items;
    expect(items.map((i: { postType: string }) => i.postType).sort()).toEqual(["Static", "Text"]);
    const postTypesWritten = mockCreateV2Draft.mock.calls.map((call) => call[0].draft.postType).sort();
    expect(postTypesWritten).toEqual(["Static", "Text"]);
  });

  it("skips generation entirely when today's locked pair already exists (idempotent)", async () => {
    const isSpy = mockExistingPostTypes(["Static", "Text"]); // Tuesday's full locked pair

    const result = await runDailyContentGeneration({ date: TUESDAY });

    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.createdPostTypes).toEqual([]);
      expect(result.skippedExistingPostTypes.sort()).toEqual(["Static", "Text"]);
    }
    // Proves the "existing post types" lookup actually excludes archived/scrapped rows the way
    // resolveUniqueDayIndex's 2026-08-31 fix does, rather than the mock silently no-op'ing the check.
    expect(isSpy).toHaveBeenCalledWith("deleted_at", null);
    expect(mockGenerateBulkContent).not.toHaveBeenCalled();
    expect(mockCreateV2Draft).not.toHaveBeenCalled();
  });

  it("generates only the missing half of today's locked pair (Wednesday: Carousel+Video)", async () => {
    expect(CONTENT_CALENDAR_WEEKDAY_POST_TYPES[2]).toEqual(["Carousel", "Video"]); // sanity-check the fixture assumption
    mockExistingPostTypes(["Carousel"]); // Video still missing
    mockGenerateBulkContent.mockResolvedValue({
      drafts: [
        {
          tempId: "t1",
          postType: "Video",
          targetGroup: "Join the Team",
          platforms: "Instagram Reels,Facebook Reels,Threads,TikTok",
          postDate: WEDNESDAY,
          dayIndex: 2,
          caption: "Video caption",
          visualPrompt: "video visual",
          hashtags: ["fitness"],
        },
      ],
      meta: {},
    });

    const result = await runDailyContentGeneration({ date: WEDNESDAY });

    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.createdPostTypes).toEqual(["Video"]);
      expect(result.skippedExistingPostTypes).toEqual(["Carousel"]);
    }
    expect(mockGenerateBulkContent).toHaveBeenCalledTimes(1);
    const items = mockGenerateBulkContent.mock.calls[0][0].items;
    expect(items.map((i: { postType: string }) => i.postType)).toEqual(["Video"]);

    expect(mockCreateV2Draft).toHaveBeenCalledTimes(1);
    expect(mockCreateV2Draft.mock.calls[0][0].draft.postType).toBe("Video");
    // Every write stays inside the approve-only rule: draft status, hub stage, scheduled lane.
    expect(mockCreateV2Draft.mock.calls[0][0].lane).toBe("scheduled");
    expect(mockCreateV2Draft.mock.calls[0][0].generateMedia).toBe(false);
  });

  it("skips a missing post type by strict match instead of guessing from a differently-shaped response", async () => {
    // Both of Wednesday's locked types (Carousel + Video) are missing, but the AI vault only
    // returns Video. A positional fallback would have wrongly matched some other item to
    // "Carousel"; the fix must skip Carousel outright rather than mislabel it.
    mockExistingPostTypes([]);
    mockGenerateBulkContent.mockResolvedValue({
      drafts: [
        {
          tempId: "t1",
          postType: "Video",
          targetGroup: "Join the Team",
          platforms: "Instagram Reels,Facebook Reels,Threads,TikTok",
          postDate: WEDNESDAY,
          dayIndex: 2,
          caption: "Video caption",
          visualPrompt: "video visual",
          hashtags: ["fitness"],
        },
        // "Carousel" never comes back at all.
      ],
      meta: {},
    });

    const result = await runDailyContentGeneration({ date: WEDNESDAY });

    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.createdPostTypes).toEqual(["Video"]);
    }
    expect(mockCreateV2Draft).toHaveBeenCalledTimes(1);
    expect(mockCreateV2Draft.mock.calls[0][0].draft.postType).toBe("Video");
    // Never wrote a "Carousel" row using some other type's content.
    expect(mockCreateV2Draft.mock.calls.some((call) => call[0].draft.postType === "Carousel")).toBe(false);
  });
});
