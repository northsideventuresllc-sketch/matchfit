import { describe, expect, it } from "vitest";
import {
  formatUserMessageForDisplay,
  sanitizeAssistantMessageForDisplay,
} from "@/lib/admin-assistant-labels";

describe("sanitizeAssistantMessageForDisplay", () => {
  it("replaces legacy JSON context dumps with a friendly message", () => {
    const raw = "AI unavailable (no OPENAI_API_KEY). Context snapshot:\n{\n  \"members\": {}\n}";
    expect(sanitizeAssistantMessageForDisplay(raw)).toContain("temporarily offline");
    expect(sanitizeAssistantMessageForDisplay(raw)).not.toContain("members");
  });

  it("replaces API key jargon with operator-friendly copy", () => {
    expect(sanitizeAssistantMessageForDisplay("Add OPENAI_API_KEY to enable AI goal parsing.")).toContain(
      "not fully configured",
    );
  });

  it("passes through normal assistant prose", () => {
    const prose = "Your top landing page is /client/sign-up. Try adding social proof near the CTA.";
    expect(sanitizeAssistantMessageForDisplay(prose)).toBe(prose);
  });
});

describe("formatUserMessageForDisplay", () => {
  it("maps bare action slugs to friendly labels", () => {
    expect(formatUserMessageForDisplay("site analysis", "site_analysis")).toBe("Analyze site traffic");
  });

  it("keeps custom user questions intact", () => {
    expect(formatUserMessageForDisplay("How are trainer sign-ups trending?", "freeform")).toBe(
      "How are trainer sign-ups trending?",
    );
  });
});
