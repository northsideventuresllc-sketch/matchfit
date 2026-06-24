import { describe, expect, it } from "vitest";
import {
  buildBulkSlotBrief,
  buildOperatorCreativeDirective,
  extractSlotDirectiveFromOperatorPrompt,
  isLazyCalendarCaption,
  isLazyCalendarDraft,
  isLazyCalendarVisualPrompt,
  normalizeGeneratedVisualPrompt,
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
      customPrompt:
        "-Join The Team: Highlight founding background-check coverage and Premium Pro trial.\n-List With Us: listing benefits\n-Clients: VIP trial",
      dayLabel: "Monday",
    });

    expect(brief).toContain("Slot 1: Carousel → Join the Team");
    expect(brief).toContain("Audience-specific operator notes");
    expect(brief).toContain("founding background-check coverage");
    expect(brief).toContain("Caption structure:");
    expect(brief).toContain("Visual prompt structure:");
    expect(brief).toContain("Drive to match-fit.net/trainer/signup");
  });

  it("flags lazy template captions and color-only visual prompts", () => {
    expect(
      isLazyCalendarCaption("Carousel for Join the Team — Match Fit beta. match-fit.net"),
    ).toBe(true);
    expect(isLazyCalendarCaption("Could not generate Carousel for Join the Team.")).toBe(true);
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
        visualPrompt: "short",
        postType: "Carousel",
      }),
    ).toBe(false);
  });

  it("extracts audience-specific operator notes from structured prompts", () => {
    const prompt = `Each post should target each audience evenly.

-Join The Team: background check covered for first 10 Match Fit Pros
-List With Us: independent listing benefits
-Clients: 60 day VIP pass for first 150 clients and Fit Hub

RULES:
-Focus on additives`;

    const joinStatic = extractSlotDirectiveFromOperatorPrompt(prompt, "Join the Team", "Static");
    expect(joinStatic).toMatch(/background check/i);
    expect(joinStatic).toMatch(/Mandatory for this slot/i);

    const clients = extractSlotDirectiveFromOperatorPrompt(prompt, "Clients", "Carousel");
    expect(clients).toMatch(/VIP/i);
    expect(clients).toMatch(/Fit Hub/i);
  });

  it("fills in visual prompts when the model omits them", () => {
    const visual = normalizeGeneratedVisualPrompt({
      caption: "First 10 Match Fit Pros get fully covered background checks. Join at match-fit.net/trainer/signup.",
      visualPrompt: null,
      postType: "Static",
      targetGroup: "Join the Team",
    });
    expect(visual).toMatch(/Join the Team/i);
    expect(visual).toMatch(/headline|fitness scene/i);
  });
});
