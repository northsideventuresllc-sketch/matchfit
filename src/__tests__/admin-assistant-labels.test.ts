import { describe, expect, it } from "vitest";
import {
  formatAssistantStatsSnapshot,
  formatConversationTitleForDisplay,
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

describe("formatConversationTitleForDisplay", () => {
  it("shows NEW CONVERSATION for default titles", () => {
    expect(formatConversationTitleForDisplay("New conversation")).toBe("NEW CONVERSATION");
    expect(formatConversationTitleForDisplay("Start a conversation")).toBe("NEW CONVERSATION");
    expect(formatConversationTitleForDisplay(null)).toBe("NEW CONVERSATION");
  });

  it("preserves custom conversation titles", () => {
    expect(formatConversationTitleForDisplay("Weekly sign-up review")).toBe("Weekly sign-up review");
  });
});

describe("formatAssistantStatsSnapshot", () => {
  it("uses dashboard-aligned member labels and includes trainer breakdown", () => {
    const result = formatAssistantStatsSnapshot({
      allMembersTotal: 1,
      subscribedClients: 12,
      compliantActiveTrainers: 20,
      pendingTrainers: 4,
      vipTrialClients: 7,
      uniqueVisitors7d: 99,
    });

    expect(result.line).toBe(
      "1 all members total · 12 subscribed clients · 20 active trainers · 4 pending trainers · 7 VIP trials · 99 visitors (7d)",
    );
    expect(result.hint).toContain("Subscribed clients");
  });
});
