import { describe, expect, it } from "vitest";
import {
  OUTREACH_COWORK_DAILY_CAPS,
  OUTREACH_INTENT_VALUES,
  buildCoworkBriefInstructions,
  buildCoworkRunnerPrompt,
  isOutreachIntent,
  outreachSendRequiresIntent,
} from "@/lib/outreach-cowork";

describe("outreach-cowork", () => {
  it("recognizes locked outreach intents", () => {
    for (const value of OUTREACH_INTENT_VALUES) {
      expect(isOutreachIntent(value)).toBe(true);
    }
    expect(isOutreachIntent("MAYBE")).toBe(false);
    expect(isOutreachIntent(null)).toBe(false);
  });

  it("requires intent before IG/email send claim statuses", () => {
    expect(outreachSendRequiresIntent("instagram", "OUTREACH_SENT")).toBe(true);
    expect(outreachSendRequiresIntent("email", "FOLLOW_UP_1")).toBe(true);
    expect(outreachSendRequiresIntent("instagram", "LEAD")).toBe(false);
    expect(outreachSendRequiresIntent("facebook", "OUTREACH_SENT")).toBe(false);
  });

  it("builds runner prompt with daily caps and email From/BCC", () => {
    const prompt = buildCoworkRunnerPrompt("2026-07-14T12:00:00.000Z");
    expect(prompt).toContain(`${OUTREACH_COWORK_DAILY_CAPS.instagram} Instagram`);
    expect(prompt).toContain(`${OUTREACH_COWORK_DAILY_CAPS.email} email`);
    expect(prompt).toContain("jb@match-fit.net");
    expect(prompt).toContain("support@match-fit.net");
    expect(prompt).toContain("/api/admin/outreach/cowork-brief");
    expect(prompt).toContain("Like 4 recent posts");
    expect(prompt).toContain("Join as Fitness Pro / Both ready hub leads first");
  });

  it("builds brief instructions that ban send without intent", () => {
    const instructions = buildCoworkBriefInstructions();
    expect(instructions).toContain("Never send without intent");
    expect(instructions).toContain("OUTREACH_SENT");
  });
});
