import { describe, expect, it } from "vitest";
import {
  buildBulkSlotBrief,
  buildOperatorCreativeDirective,
  isLazyCalendarCaption,
  isLazyCalendarDraft,
  isLazyCalendarVisualPrompt,
} from "@/lib/content-calendar/content-prompts";

describe("content-prompts", () => {
  it("elevates the operator prompt to a primary creative directive", () => {
    const directive = buildOperatorCreativeDirective("Lead with founding background-check coverage and Fit Hub.");
    expect(directive).toMatch(/PRIMARY OPERATOR DIRECTIVE/i);
    expect(directive).toContain("founding background-check coverage");
    expect(directive).toMatch(/MUST weave/i);
  });

  it("builds slot briefs with audience goals and post-type structure", () => {
    const brief = buildBulkSlotBrief({
      index: 0,
      item: { postType: "Carousel", targetGroup: "Join the Team" },
      customPrompt: "Highlight Premium Pro trial and verified onboarding.",
      dayLabel: "Monday",
    });

    expect(brief).toContain("Slot 1: Carousel → Join the Team");
    expect(brief).toContain("Highlight Premium Pro trial");
    expect(brief).toContain("Caption structure:");
    expect(brief).toContain("Visual prompt structure:");
    expect(brief).toContain("Drive to match-fit.net/trainer/signup");
  });

  it("flags lazy template captions and color-only visual prompts", () => {
    expect(
      isLazyCalendarCaption("Carousel for Join the Team — Match Fit beta. match-fit.net"),
    ).toBe(true);
    expect(
      isLazyCalendarVisualPrompt(
        "Dark #07080C, orange #FF7E00. Carousel for Join the Team.",
        "Carousel",
      ),
    ).toBe(true);
    expect(
      isLazyCalendarDraft({
        caption:
          "Your next client is already scrolling — Match Fit Premium Pro gives verified Fitness Pros discovery, in-app chat, and founding onboarding support. Start at match-fit.net/trainer/signup.",
        visualPrompt:
          "Carousel frame 1: coach reviewing client matches on phone in modern gym, orange headline 'Verified Pros Get Found', dark background, confident mood.",
        postType: "Carousel",
      }),
    ).toBe(false);
  });
});
