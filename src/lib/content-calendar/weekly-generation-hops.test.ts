import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard for the chained-hops refactor (MF-CONTENT-GEN-VERCEL-504-0907, PR #368).
// weekly-generation.ts was split into two exported halves the weekly cron route now chains:
//   4. planWeeklyGeneration() — the heavy shared prep (DPMO phase + social scan + hashtag research
//      + 5-day AI plan) the top-level request runs ONCE before fanning out. Must return a full
//      Mon-Fri (dayIndex 0..4) plan plus the snapshot each per-day hop is handed.
//   5. generateWeeklyDayPosts() — one bounded day's generation from an already-made plan. Must
//      produce exactly that weekday's JB-locked pair (Mon/Wed/Fri Carousel+Video, Tue/Thu
//      Static+Text), never the other pair.

import type { HashtagResearchSnapshot } from "@/lib/content-calendar/hashtag-research";
import type { WeeklyDayPlan } from "@/lib/content-calendar/weekly-generation";

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

vi.mock("@/lib/hydrate-platform-env", () => ({ hydratePlatformEnvFromDatabase: mockHydratePlatformEnvFromDatabase }));
vi.mock("@/lib/ai-vault", () => ({ getAiVaultStatus: mockGetAiVaultStatus }));
vi.mock("@/lib/ai-vault/router", () => ({ callMatchFitAi: vi.fn() }));
vi.mock("@/lib/content-calendar/cowork-jobs", () => ({ getMatchFitDpmoPhase: mockGetMatchFitDpmoPhase }));
vi.mock("@/lib/content-calendar/social-profile-scan", () => ({
  scanAndRecordSocialProfiles: mockScanAndRecordSocialProfiles,
}));
vi.mock("@/lib/content-calendar/hashtag-research", () => ({ researchTrendingHashtags: mockResearchTrendingHashtags }));
vi.mock("@/lib/content-calendar/content-context", () => ({
  buildContentGenerationContext: mockBuildContentGenerationContext,
  resetContentContextCache: mockResetContentContextCache,
}));
vi.mock("@/lib/content-calendar/content-calendar-ai", () => ({ generateBulkContent: mockGenerateBulkContent }));
vi.mock("@/lib/content-calendar/content-prompts", () => ({ buildMediaGenerationPrompt: mockBuildMediaGenerationPrompt }));
vi.mock("@/lib/content-calendar/content-calendar-v2-store", () => ({ createV2Draft: mockCreateV2Draft }));

import { planWeeklyGeneration, generateWeeklyDayPosts } from "@/lib/content-calendar/weekly-generation";

const HASHTAGS: HashtagResearchSnapshot = {
  researchedAt: "2026-09-07T00:00:00.000Z",
  usedWebSearch: true,
  provider: "axon-local",
  hashtags: ["MatchFit", "fitness"],
  trends: [],
  notes: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockHydratePlatformEnvFromDatabase.mockResolvedValue(undefined);
  // configured:false → planWeek uses the deterministic fallback plan (no live AI call needed).
  mockGetAiVaultStatus.mockReturnValue({ configured: false });
  mockGetMatchFitDpmoPhase.mockResolvedValue("phase1");
  mockScanAndRecordSocialProfiles.mockResolvedValue({ summary: "quiet week", scannedAt: "2026-09-07T12:00:00.000Z" });
  mockResearchTrendingHashtags.mockResolvedValue(HASHTAGS);
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

describe("planWeeklyGeneration", () => {
  it("runs the shared prep once and returns a full Mon-Fri plan plus the per-hop snapshot", async () => {
    const result = await planWeeklyGeneration({ weekStart: "2026-09-07" });

    // Heavy shared prep runs exactly once here (it is not repeated per hop).
    expect(mockScanAndRecordSocialProfiles).toHaveBeenCalledTimes(1);
    expect(mockResearchTrendingHashtags).toHaveBeenCalledTimes(1);

    expect(result.weekStart).toBe("2026-09-07");
    expect(result.dpmoPhase).toBe("phase1");
    expect(result.socialScanSnapshotId).toBeTruthy();
    expect(result.hashtags).toEqual(HASHTAGS);

    // Exactly the 5 weekdays, in order, each with the fields a day hop needs.
    expect(result.plan.map((d) => d.dayIndex)).toEqual([0, 1, 2, 3, 4]);
    for (const day of result.plan) {
      expect(day.theme).toBeTruthy();
      expect(day.targetAudience).toBeTruthy();
      expect(day.cta).toBeTruthy();
    }

    // Planning alone must NOT generate or write any posts — that is each day hop's job.
    expect(mockGenerateBulkContent).not.toHaveBeenCalled();
    expect(mockCreateV2Draft).not.toHaveBeenCalled();
  });
});

describe("generateWeeklyDayPosts", () => {
  const baseArgs = {
    weekStart: "2026-09-07",
    dpmoPhase: "phase1" as string | null,
    socialScanSnapshotId: "scan_1",
    hashtags: HASHTAGS,
  };

  it("generates Monday's locked Carousel+Video pair from a supplied plan", async () => {
    const dayPlan: WeeklyDayPlan = {
      dayIndex: 0,
      theme: "Monday spotlight",
      targetAudience: "Clients",
      cta: "Drive to match-fit.net/client/sign-up",
      dpmoRationale: "Kick the week off on clients.",
    };

    const result = await generateWeeklyDayPosts({ ...baseArgs, dayPlan });

    expect(result.dayIndex).toBe(0);
    expect(result.created).toBe(2);

    expect(mockGenerateBulkContent).toHaveBeenCalledTimes(1);
    const items = mockGenerateBulkContent.mock.calls[0][0].items as { postType: string }[];
    expect(items.map((i) => i.postType).sort()).toEqual(["Carousel", "Video"]);

    const written = mockCreateV2Draft.mock.calls.map((call) => call[0].draft.postType).sort();
    expect(written).toEqual(["Carousel", "Video"]);
    for (const call of mockCreateV2Draft.mock.calls) {
      expect(call[0].draft.dayIndex).toBe(0);
      expect(call[0].lane).toBe("scheduled");
      expect(call[0].generateMedia).toBe(false);
    }
  });

  it("generates Tuesday's locked Static+Text pair — never Carousel or Video", async () => {
    const dayPlan: WeeklyDayPlan = {
      dayIndex: 1,
      theme: "Tuesday spotlight",
      targetAudience: "Join the Team",
      cta: "Drive to match-fit.net/trainer/sign-up",
      dpmoRationale: "Recruit Fitness Pros.",
    };

    const result = await generateWeeklyDayPosts({ ...baseArgs, dayPlan });

    expect(result.created).toBe(2);
    const written = mockCreateV2Draft.mock.calls.map((call) => call[0].draft.postType).sort();
    expect(written).toEqual(["Static", "Text"]);
    expect(written).not.toContain("Carousel");
    expect(written).not.toContain("Video");
  });
});
