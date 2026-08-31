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
  Object.assign(builder, {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    then: (resolve: (v: unknown) => void) =>
      resolve({ data: postTypes.map((post_type) => ({ post_type })), error: null }),
  });
  mockCreateNiBrainClient.mockReturnValue({ from: () => builder });
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
    mockExistingPostTypes(["Carousel", "Static", "Video", "Text"]);

    const result = await runDailyContentGeneration({ date: "2026-09-01" }); // Tuesday

    expect(result.ran).toBe(true);
    if (result.ran) {
      expect(result.createdPostTypes).toEqual([]);
      expect(result.skippedExistingPostTypes).toHaveLength(4);
    }
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
});
