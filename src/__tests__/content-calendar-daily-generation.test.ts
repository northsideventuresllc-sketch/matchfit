import { beforeEach, describe, expect, it, vi } from "vitest";

// Coverage for the daily Content Hub top-up (daily-generation.ts): the "AXON agents do the
// research and push it to the MF portal every day" pipeline. Three behaviors matter most:
// (1) it never runs on a weekend (Match Fit's calendar is Monday-Friday only), (2) it never
// re-generates a post type that's already sitting in the Hub (idempotent, no over-generation),
// and (3) when it does generate, it only asks for the post types actually missing.

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
    const result = await runDailyContentGeneration({ date: "2026-09-05" }); // Saturday

    expect(result.ran).toBe(false);
    expect(mockCreateNiBrainClient).not.toHaveBeenCalled();
    expect(mockGenerateBulkContent).not.toHaveBeenCalled();
    expect(mockCreateV2Draft).not.toHaveBeenCalled();
  });

  it("skips generation entirely when all four post types already exist for today (idempotent)", async () => {
    const isSpy = mockExistingPostTypes(["Carousel", "Static", "Video", "Text"]);

    const result = await runDailyContentGeneration({ date: "2026-09-01" }); // Tuesday

    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.createdPostTypes).toEqual([]);
      expect(result.skippedExistingPostTypes).toHaveLength(4);
    }
    // Proves the "existing post types" lookup actually excludes archived/scrapped rows the way
    // resolveUniqueDayIndex's 2026-08-31 fix does, rather than the mock silently no-op'ing the check.
    expect(isSpy).toHaveBeenCalledWith("deleted_at", null);
    expect(mockGenerateBulkContent).not.toHaveBeenCalled();
    expect(mockCreateV2Draft).not.toHaveBeenCalled();
  });

  it("generates only the missing post types and writes one draft per missing type", async () => {
    mockExistingPostTypes(["Carousel", "Static"]); // Video + Text missing
    mockGenerateBulkContent.mockResolvedValue({
      drafts: [
        {
          tempId: "t1",
          postType: "Video",
          targetGroup: "Join the Team",
          platforms: "TikTok,Instagram",
          postDate: "2026-09-01",
          dayIndex: 1,
          caption: "Video caption",
          visualPrompt: "video visual",
          hashtags: ["fitness"],
        },
        {
          tempId: "t2",
          postType: "Text",
          targetGroup: "Join the Team",
          platforms: "Threads,Facebook",
          postDate: "2026-09-01",
          dayIndex: 1,
          caption: "Text caption",
          visualPrompt: null,
          hashtags: ["fitness"],
        },
      ],
      meta: {},
    });

    const result = await runDailyContentGeneration({ date: "2026-09-01" }); // Tuesday

    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.createdPostTypes.sort()).toEqual(["Text", "Video"]);
      expect(result.skippedExistingPostTypes.sort()).toEqual(["Carousel", "Static"]);
    }

    // Only asked the AI vault to generate the two missing types, never the two already in the Hub.
    expect(mockGenerateBulkContent).toHaveBeenCalledTimes(1);
    const items = mockGenerateBulkContent.mock.calls[0][0].items;
    expect(items.map((i: { postType: string }) => i.postType).sort()).toEqual(["Text", "Video"]);

    // One draft written per missing post type, never one for an already-existing type.
    expect(mockCreateV2Draft).toHaveBeenCalledTimes(2);
    const postTypesWritten = mockCreateV2Draft.mock.calls.map((call) => call[0].draft.postType).sort();
    expect(postTypesWritten).toEqual(["Text", "Video"]);

    // Every write stays inside the approve-only rule: draft status, hub stage, scheduled lane.
    for (const call of mockCreateV2Draft.mock.calls) {
      expect(call[0].lane).toBe("scheduled");
      expect(call[0].generateMedia).toBe(false);
    }
  });

  it("skips a missing post type by strict match instead of guessing from a differently-ordered response", async () => {
    // Video + Text are missing, but the AI vault returns them out of request order AND labeled
    // with only one matching postType -- a positional fallback (drafts[i]) would have wrongly
    // saved the "Carousel" draft under "Video". The fix must match strictly by postType and skip
    // (not mislabel) whichever requested type genuinely never came back.
    mockExistingPostTypes(["Static"]); // Carousel, Video, Text missing
    mockGenerateBulkContent.mockResolvedValue({
      drafts: [
        {
          tempId: "t1",
          postType: "Text",
          targetGroup: "Join the Team",
          platforms: "Threads,Facebook",
          postDate: "2026-09-01",
          dayIndex: 1,
          caption: "Text caption",
          visualPrompt: null,
          hashtags: ["fitness"],
        },
        {
          tempId: "t2",
          postType: "Carousel", // mislabeled / out of order -- NOT one of the three missing types' order
          targetGroup: "Join the Team",
          platforms: "Instagram",
          postDate: "2026-09-01",
          dayIndex: 1,
          caption: "Carousel caption",
          visualPrompt: "carousel visual",
          hashtags: ["fitness"],
        },
        // "Video" never comes back at all.
      ],
      meta: {},
    });

    const result = await runDailyContentGeneration({ date: "2026-09-01" });

    expect(result.ran).toBe(true);
    if (result.ran) {
      // Only Text and Carousel actually matched a returned draft by postType; Video was skipped,
      // never filled in with someone else's content.
      expect(result.createdPostTypes.sort()).toEqual(["Carousel", "Text"]);
    }
    expect(mockCreateV2Draft).toHaveBeenCalledTimes(2);
    const postTypesWritten = mockCreateV2Draft.mock.calls.map((call) => call[0].draft.postType).sort();
    expect(postTypesWritten).toEqual(["Carousel", "Text"]);
    // Never wrote a "Video" row using the Carousel draft's content.
    expect(mockCreateV2Draft.mock.calls.some((call) => call[0].draft.postType === "Video")).toBe(false);
  });
});
