import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hydrate-platform-env", () => ({
  hydratePlatformEnvFromDatabase: vi.fn(async () => {}),
}));

describe("google-gemini-ai", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"caption":"Gemini wrote this."}' }] } }],
        }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts AQ-prefixed auth keys", async () => {
    process.env.GEMINI_API_KEY = "AQ.test-auth-key";
    const { isValidGeminiApiKey, resolveGeminiApiKey } = await import("@/lib/google-gemini-ai");
    expect(isValidGeminiApiKey("AQ.test-auth-key")).toBe(true);
    expect(resolveGeminiApiKey()).toBe("AQ.test-auth-key");
  });

  it("calls the native Gemini generateContent endpoint", async () => {
    process.env.GEMINI_API_KEY = "AQ.test-auth-key";
    const { callGeminiGenerateContent } = await import("@/lib/google-gemini-ai");

    const result = await callGeminiGenerateContent({
      system: "You are a copywriter.",
      user: "Write one caption.",
      jsonMode: true,
    });

    expect(result.text).toContain("Gemini wrote this");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-goog-api-key": "AQ.test-auth-key",
        }),
      }),
    );
  });
});
