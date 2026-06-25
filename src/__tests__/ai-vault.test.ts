import { describe, expect, it } from "vitest";
import { inferTaskComplexity } from "@/lib/ai-vault/complexity";
import { resolveClaudeModelForComplexity } from "@/lib/ai-vault/models";
import { CLAUDE_MODELS } from "@/lib/ai-vault/constants";

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
});
