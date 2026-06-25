import { describe, expect, it, vi } from "vitest";
import { inferTaskComplexity } from "@/lib/ai-vault/complexity";
import { resolveClaudeModelForComplexity, resolveGeminiModelChain } from "@/lib/ai-vault/models";
import { callGeminiProvider } from "@/lib/ai-vault/providers";
import { CLAUDE_MODELS, DEFAULT_GEMINI_MODEL } from "@/lib/ai-vault/constants";

describe("ai-vault complexity", () => {
  it("uses haiku for simple classification tasks", () => {
    expect(
      inferTaskComplexity({
        user: "Classify this short message.",
        kind: "classification",
        maxTokens: 300,
      }),
    ).toBe("simple");
    expect(resolveClaudeModelForComplexity("simple")).toBe(CLAUDE_MODELS.simple);
  });

  it("uses opus for research-scale prompts", () => {
    expect(
      inferTaskComplexity({
        user: "x".repeat(15_000),
        kind: "research",
        maxTokens: 8000,
      }),
    ).toBe("complex");
    expect(resolveClaudeModelForComplexity("complex")).toBe(CLAUDE_MODELS.complex);
  });

  it("defaults to sonnet for standard chat", () => {
    expect(
      inferTaskComplexity({
        user: "Summarize weekly traffic for the operator.",
        kind: "chat",
        maxTokens: 900,
      }),
    ).toBe("standard");
  });

  it("defaults Gemini to 2.5 flash and provides model fallbacks", () => {
    delete process.env.GEMINI_MODEL;
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-2.5-flash");
    expect(resolveGeminiModelChain()[0]).toBe("gemini-2.5-flash");
    expect(resolveGeminiModelChain()).toContain("gemini-2.0-flash");
  });

  it("falls back to the next Gemini model when the first is quota-blocked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: "quota exceeded" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"caption":"fallback model worked"}' }] } }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callGeminiProvider({
      system: "Return JSON",
      user: "Write caption",
      apiKey: "AIza-test-key",
      providerId: "gemini-primary",
      maxTokens: 200,
      temperature: 0.5,
      jsonMode: true,
      timeoutMs: 5000,
    });

    expect(result.text).toContain("fallback model worked");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("gemini-2.5-flash");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("gemini-2.5-flash-lite");

    vi.unstubAllGlobals();
  });
});
