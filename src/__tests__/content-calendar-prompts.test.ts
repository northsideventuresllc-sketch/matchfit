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
    const directive = buildOperatorCreativeDirective("Lead with founding Premium access and waived onboarding fees.");
    expect(directive).toMatch(/PRIMARY OPERATOR DIRECTIVE/i);
    expect(directive).toContain("founding Premium access");
    expect(directive).toMatch(/MUST weave/i);
  });

  it("builds slot briefs with audience goals and post-type structure", () => {
    const brief = buildBulkSlotBrief({
      index: 0,
      item: { postType: "Carousel", targetGroup: "Join the Team" },
      customPrompt:
        "-Join The Team: Highlight founding Premium access and waived onboarding fees.\n-List With Us: listing benefits\n-Clients: VIP trial",
      dayLabel: "Monday",
    });

    expect(brief).toContain("Slot 1: Carousel → Join the Team");
    expect(brief).toContain("Audience-specific operator notes");
    expect(brief).toContain("founding Premium access");
    expect(brief).toContain("Caption structure:");
    expect(brief).toMatch(/Same as Static|bold hook/i);
    expect(brief).toContain("Visual prompt structure:");
    expect(brief).toContain("Drive to match-fit.net/trainer/sign-up");
  });

  it("flags lazy template captions, bad social labels/URLs, and slide-inventory carousels", () => {
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
          "Your next client is already scrolling — Match Fit Premium gives verified Fitness Pros discovery, in-app chat, and founding onboarding support. Start at match-fit.net/trainer/sign-up.",
        visualPrompt: "short",
        postType: "Carousel",
      }),
    ).toBe(false);
    // "Coach" is allowed in social copy now (JB 2026-09-03) — only a broken signup URL is a hard reject.
    expect(
      isLazyCalendarDraft({
        caption: "Join as a coach at match-fit.net/trainer/sign-up.",
        visualPrompt: null,
        postType: "Static",
      }),
    ).toBe(false);
    expect(
      isLazyCalendarDraft({
        caption: "Join as a coach at match-fit.net/coach/signup.",
        visualPrompt: null,
        postType: "Static",
      }),
    ).toBe(true);
    expect(
      isLazyCalendarDraft({
        caption: "Slide 1: Proof. Slide 2: Tools. Slide 3: CTA.",
        visualPrompt: null,
        postType: "Carousel",
      }),
    ).toBe(true);
  });

  it("extracts audience-specific operator notes from structured prompts", () => {
    const prompt = `Each post should target each audience evenly.

-Join The Team: founding promo for first 30 coaches Premium and first 10 fee waiver
-List With Us: independent listing benefits
-Clients: 60 day VIP pass for first 150 clients and Fit Hub

RULES:
-Focus on additives`;

    const joinStatic = extractSlotDirectiveFromOperatorPrompt(prompt, "Join the Team", "Static");
    expect(joinStatic).toMatch(/first 30 coaches/i);
    expect(joinStatic).toMatch(/onboarding fees waived/i);
    expect(joinStatic).toMatch(/Mandatory founding promo/i);

    const clients = extractSlotDirectiveFromOperatorPrompt(prompt, "Clients", "Carousel");
    expect(clients).toMatch(/VIP/i);
    expect(clients).toMatch(/Fit Hub/i);
  });

  it("fills in visual prompts when the model omits them", () => {
    const visual = normalizeGeneratedVisualPrompt({
      caption: "First 10 coaches get onboarding fees waived. Join at match-fit.net/trainer/sign-up.",
      visualPrompt: null,
      postType: "Static",
      targetGroup: "Join the Team",
    });
    expect(visual).toMatch(/Join the Team/i);
    expect(visual).toMatch(/headline|fitness scene/i);
  });
});
