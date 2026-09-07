import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockHydratePlatformEnvFromDatabase,
  mockGetAiVaultStatus,
  mockCallMatchFitAi,
  mockCreateNiBrainClient,
  mockIsNiBrainConfigured,
  mockRecordContentLearning,
  mockMaybeSingle,
} = vi.hoisted(() => ({
  mockHydratePlatformEnvFromDatabase: vi.fn(),
  mockGetAiVaultStatus: vi.fn(),
  mockCallMatchFitAi: vi.fn(),
  mockCreateNiBrainClient: vi.fn(),
  mockIsNiBrainConfigured: vi.fn(),
  mockRecordContentLearning: vi.fn(),
  mockMaybeSingle: vi.fn(),
}));

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: mockHydratePlatformEnvFromDatabase,
}));
vi.mock("@/lib/ai-vault", () => ({ getAiVaultStatus: mockGetAiVaultStatus }));
vi.mock("@/lib/ai-vault/router", () => ({ callMatchFitAi: mockCallMatchFitAi }));
vi.mock("@/lib/ni-brain-client", () => ({
  createNiBrainClient: mockCreateNiBrainClient,
  isNiBrainConfigured: mockIsNiBrainConfigured,
  recordContentLearning: mockRecordContentLearning,
}));

import {
  researchTrendingHashtags,
  HASHTAG_RESEARCH_FRESHNESS_MS,
} from "@/lib/content-calendar/hashtag-research";

/** Minimal PostgREST-style query builder that terminates at .maybeSingle(). */
function makeQueryBuilder() {
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "select", "eq", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = mockMaybeSingle;
  return builder;
}

function freshSnapshotRow(overrides?: { researchedAt?: string; hashtags?: string[] }) {
  return {
    data: {
      created_at: new Date().toISOString(),
      meta_json: {
        snapshot: {
          researchedAt: overrides?.researchedAt ?? new Date().toISOString(),
          usedWebSearch: true,
          provider: "anthropic",
          hashtags: overrides?.hashtags ?? ["fitness", "gym", "personaltrainer"],
          trends: ["fitness is trending"],
          notes: "cached snapshot",
        },
      },
    },
    error: null,
  };
}

describe("researchTrendingHashtags — 24h cache short-circuits the live web search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHydratePlatformEnvFromDatabase.mockResolvedValue(undefined);
    mockGetAiVaultStatus.mockReturnValue({ configured: true });
    mockIsNiBrainConfigured.mockReturnValue(true);
    mockRecordContentLearning.mockResolvedValue(undefined);
    mockCreateNiBrainClient.mockImplementation(() => makeQueryBuilder());
  });

  it("returns the fresh cached snapshot and does NOT invoke the AI web_search call", async () => {
    mockMaybeSingle.mockResolvedValue(freshSnapshotRow({ hashtags: ["fitness", "gym"] }));

    const result = await researchTrendingHashtags({ dpmoPhase: "phase1" });

    expect(result.hashtags).toEqual(["fitness", "gym"]);
    expect(result.usedWebSearch).toBe(true);
    // The whole point: zero live web search on the hot path.
    expect(mockCallMatchFitAi).not.toHaveBeenCalled();
  });

  it("does the live search (capped at 25s, web_search tool) and falls back on empty when no fresh cache", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockCallMatchFitAi.mockResolvedValue({ text: "", provider: null });

    const result = await researchTrendingHashtags({ dpmoPhase: "phase1" });

    expect(mockCallMatchFitAi).toHaveBeenCalledTimes(1);
    const callArg = mockCallMatchFitAi.mock.calls[0][0] as {
      timeoutMs: number;
      anthropicTools: Array<{ name: string }>;
    };
    expect(callArg.timeoutMs).toBe(25_000);
    expect(callArg.timeoutMs).toBeLessThan(120_000);
    expect(callArg.anthropicTools.some((t) => t.name === "web_search")).toBe(true);
    // Empty AI text → static high-volume fallback, not a crash or empty result.
    expect(result.usedWebSearch).toBe(false);
    expect(result.hashtags.length).toBeGreaterThan(0);
  });

  it("treats a snapshot older than 24h as stale and performs the live search", async () => {
    const stale = new Date(Date.now() - HASHTAG_RESEARCH_FRESHNESS_MS - 60_000).toISOString();
    mockMaybeSingle.mockResolvedValue(freshSnapshotRow({ researchedAt: stale }));
    mockCallMatchFitAi.mockResolvedValue({ text: "", provider: null });

    await researchTrendingHashtags({ dpmoPhase: "phase1" });

    expect(mockCallMatchFitAi).toHaveBeenCalledTimes(1);
  });

  it("forceRefresh bypasses a fresh cache and still runs the live search", async () => {
    mockMaybeSingle.mockResolvedValue(freshSnapshotRow());
    mockCallMatchFitAi.mockResolvedValue({ text: "", provider: null });

    await researchTrendingHashtags({ dpmoPhase: "phase1", forceRefresh: true });

    expect(mockCallMatchFitAi).toHaveBeenCalledTimes(1);
  });

  it("persists the full snapshot into meta.snapshot so the next run reads it from cache", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockCallMatchFitAi.mockResolvedValue({
      text: JSON.stringify({ hashtags: ["fitness", "gym"], trends: ["t"], notes: "n" }),
      provider: "anthropic",
    });

    await researchTrendingHashtags({ dpmoPhase: "phase1" });

    expect(mockRecordContentLearning).toHaveBeenCalledTimes(1);
    const learningArg = mockRecordContentLearning.mock.calls[0][0] as {
      signalType: string;
      meta: { snapshot?: { hashtags: string[] } };
    };
    expect(learningArg.signalType).toBe("HASHTAG_RESEARCH");
    expect(learningArg.meta.snapshot).toBeTruthy();
    expect(Array.isArray(learningArg.meta.snapshot?.hashtags)).toBe(true);
  });

  it("returns fallback (no crash) when the AI call throws — e.g. a short-timeout abort", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockCallMatchFitAi.mockRejectedValue(new Error("aborted: timeout"));

    const result = await researchTrendingHashtags({ dpmoPhase: "phase1" });

    expect(result.usedWebSearch).toBe(false);
    expect(result.hashtags.length).toBeGreaterThan(0);
  });
});
