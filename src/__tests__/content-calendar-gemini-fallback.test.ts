import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAdminAiProviderStatusAsync = vi.fn();
const callGeminiGenerateContent = vi.fn();

vi.mock("@/lib/admin-analytics-ai", () => ({
  getAdminAiProviderStatus: vi.fn(() => ({
    provider: "anthropic",
    configured: true,
    working: false,
    model: "claude-sonnet-4-6",
    message: "ok",
  })),
  getAdminAiProviderStatusAsync,
}));

vi.mock("@/lib/google-gemini-ai", () => ({
  callGeminiGenerateContent,
  isGeminiFallbackConfigured: vi.fn(() => true),
  resolveGeminiModel: vi.fn(() => "gemini-2.0-flash"),
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

describe("content-calendar Gemini fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    getAdminAiProviderStatusAsync.mockResolvedValue({
      provider: "anthropic",
      configured: true,
      working: true,
      model: "claude-sonnet-4-6",
      message: "ok",
    });
    callGeminiGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        caption:
          "Gemini fallback caption with founding background-check coverage for the first 10 Match Fit Pros.",
        visualPrompt: "Static graphic with Fitness Pro onboarding scene.",
        hashtags: ["MatchFit"],
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted.", "TimeoutError");
      }),
    );
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.unstubAllGlobals();
  });

  it("falls back to Gemini when Anthropic times out", async () => {
    const { generateBulkContent } = await import("@/lib/content-calendar/content-calendar-ai");
    const result = await generateBulkContent({
      items: [{ postType: "Static", targetGroup: "Join the Team" }],
      scheduled: false,
      weekStart: "2026-06-09",
      customPrompt: "Lead with founding background-check coverage.",
    });

    expect(callGeminiGenerateContent).toHaveBeenCalled();
    expect(result.meta.usedGeminiFallback).toBe(true);
    expect(result.drafts[0]?.caption).toMatch(/Gemini fallback caption/i);
  });
});
