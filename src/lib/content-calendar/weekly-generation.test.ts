import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockHydratePlatformEnvFromDatabase,
  mockGetAiVaultStatus,
  mockGetMatchFitDpmoPhase,
  mockScanAndRecordSocialProfiles,
  mockResearchTrendingHashtags,
  mockBuildContentGenerationContext,
  mockResetContentContextCache,
  mockGenerateBulkContent,
  mockBuildMediaGenerationPrompt,
  mockCreateV2Draft,
} = vi.hoisted(() => ({
  mockHydratePlatformEnvFromDatabase: vi.fn(),
  mockGetAiVaultStatus: vi.fn(),
  mockGetMatchFitDpmoPhase: vi.fn(),
  mockScanAndRecordSocialProfiles: vi.fn(),
  mockResearchTrendingHashtags: vi.fn(),
  mockBuildContentGenerationContext: vi.fn(),
  mockResetContentContextCache: vi.fn(),
  mockGenerateBulkContent: vi.fn(),
  mockBuildMediaGenerationPrompt: vi.fn(),
  mockCreateV2Draft: vi.fn(),
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: mockHydratePlatformEnvFromDatabase,
}));
vi.mock("@/lib/ai-vault", () => ({ getAiVaultStatus: mockGetAiVaultStatus }));
vi.mock("@/lib/ai-vault/router", () => ({ callMatchFitAi: vi.fn() }));
vi.mock("@/lib/content-calendar/cowork-jobs", () => ({ getMatchFitDpmoPhase: mockGetMatchFitDpmoPhase }));
vi.mock("@/lib/content-calendar/social-profile-scan", () => ({
  scanAndRecordSocialProfiles: mockScanAndRecordSocialProfiles,
}));
vi.mock("@/lib/content-calendar/hashtag-research", () => ({
  researchTrendingHashtags: mockResearchTrendingHashtags,
}));
vi.mock("@/lib/content-calendar/content-context", () => ({
  buildContentGenerationContext: mockBuildContentGenerationContext,
  resetContentContextCache: mockResetContentContextCache,
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

import { runWeeklyContentGeneration } from "@/lib/content-calendar/weekly-generation";
import { CONTENT_CALENDAR_WEEKDAY_POST_TYPES } from "@/lib/content-calendar/constants";

describe("runWeeklyContentGeneration — per-weekday post type lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHydratePlatformEnvFromDatabase.mockResolvedValue(undefined);
    mockGetAiVaultStatus.mockReturnValue({ configured: false });
    mockGetMatchFitDpmoPhase.mockResolvedValue("phase1");
    mockScanAndRecordSocialProfiles.mockResolvedValue({ summary: "quiet week", scannedAt: new Date().toISOString() });
    mockResearchTrendingHashtags.mockResolvedValue({ hashtags: ["MatchFit"], trends: [] });
    mockBuildContentGenerationContext.mockResolvedValue("context");
    mockBuildMediaGenerationPrompt.mockReturnValue("visual prompt");
    mockGenerateBulkContent.mockImplementation(async (args: { items: { postType: string }[] }) => ({
      drafts: args.items.map((item) => ({
        postType: item.postType,
        caption: `${item.postType} caption`,
        visualPrompt: `${item.postType} visual`,
        dayIndex: 0,
        postDate: null,
      })),
      meta: {},
    }));
    mockCreateV2Draft.mockResolvedValue({ id: "post_1" });
  });

  it("only requests each day's two locked post types — never all four", async () => {
    await runWeeklyContentGeneration({ weekStart: "2026-09-07" });

    expect(mockGenerateBulkContent).toHaveBeenCalledTimes(5);
    const callsByDay = mockGenerateBulkContent.mock.calls.map(
      (call) => (call[0] as { items: { postType: string }[] }).items.map((i) => i.postType),
    );

    for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
      expect(callsByDay[dayIndex].sort()).toEqual([...CONTENT_CALENDAR_WEEKDAY_POST_TYPES[dayIndex]].sort());
    }
  });

  it("locks Monday/Wednesday/Friday to Carousel + Video only", async () => {
    await runWeeklyContentGeneration({ weekStart: "2026-09-07" });

    const createdTypesByDay: Record<number, string[]> = { 0: [], 2: [], 4: [] };
    for (const call of mockCreateV2Draft.mock.calls) {
      const arg = call[0] as { draft: { dayIndex: number; postType: string } };
      if (arg.draft.dayIndex in createdTypesByDay) createdTypesByDay[arg.draft.dayIndex].push(arg.draft.postType);
    }

    for (const dayIndex of [0, 2, 4]) {
      expect(createdTypesByDay[dayIndex].sort()).toEqual(["Carousel", "Video"]);
    }
  });

  it("locks Tuesday/Thursday to Static + Text only — never Video or Carousel", async () => {
    await runWeeklyContentGeneration({ weekStart: "2026-09-07" });

    const createdTypesByDay: Record<number, string[]> = { 1: [], 3: [] };
    for (const call of mockCreateV2Draft.mock.calls) {
      const arg = call[0] as { draft: { dayIndex: number; postType: string } };
      if (arg.draft.dayIndex in createdTypesByDay) createdTypesByDay[arg.draft.dayIndex].push(arg.draft.postType);
    }

    for (const dayIndex of [1, 3]) {
      expect(createdTypesByDay[dayIndex].sort()).toEqual(["Static", "Text"]);
      expect(createdTypesByDay[dayIndex]).not.toContain("Video");
      expect(createdTypesByDay[dayIndex]).not.toContain("Carousel");
    }
  });

  it("creates exactly 10 posts for the week (5 days x 2 locked types), never 20", async () => {
    const result = await runWeeklyContentGeneration({ weekStart: "2026-09-07" });
    expect(result.createdPostCount).toBe(10);
    expect(mockCreateV2Draft).toHaveBeenCalledTimes(10);
  });
});
