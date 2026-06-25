import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const callMatchFitAi = vi.fn();

vi.mock("@/lib/ai-vault/router", () => ({
  callMatchFitAi,
}));

vi.mock("@/lib/content-calendar/content-context", () => ({
  buildContentGenerationContext: vi.fn(async () => "context"),
}));

vi.mock("@/lib/content-calendar/social-profile-scan", () => ({
  scanAndRecordSocialProfiles: vi.fn(),
}));

vi.mock("@/lib/ni-brain-client", () => ({
  recordContentLearning: vi.fn(async () => {}),
}));

describe("content-calendar AI vault fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    callMatchFitAi.mockReset();
    callMatchFitAi.mockResolvedValue({
      text: JSON.stringify({
        caption:
          "Gemini fallback caption with founding background-check coverage for the first 10 Match Fit Pros.",
        visualPrompt: "Static graphic with Fitness Pro onboarding scene.",
        hashtags: ["MatchFit"],
      }),
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      complexity: "standard",
      usedFallback: false,
      attempts: [],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the AI vault router for bulk generation", async () => {
    const { generateBulkContent } = await import("@/lib/content-calendar/content-calendar-ai");
    const result = await generateBulkContent({
      items: [{ postType: "Static", targetGroup: "Join the Team" }],
      scheduled: false,
      weekStart: "2026-06-09",
      customPrompt: "Lead with founding background-check coverage.",
    });

    expect(callMatchFitAi).toHaveBeenCalled();
    expect(result.drafts[0]?.caption).toMatch(/Gemini fallback caption/i);
  });
});
