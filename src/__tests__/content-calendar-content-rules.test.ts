import { describe, expect, it } from "vitest";
import {
  CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT,
  enforceGeneratedPostContent,
  fitCaptionForRepurpose,
  normalizeUserEditedPostContent,
  repurposePostLength,
} from "@/lib/content-calendar/content-rules";

describe("content-calendar content rules", () => {
  it("preserves full AI-generated captions and flags over-limit posts (soft warning, no hard truncation)", () => {
    const longCaption = "A".repeat(600);
    const enforced = enforceGeneratedPostContent({
      caption: longCaption,
      hashtags: ["MatchFit"],
    });

    expect(enforced.caption).toBe(longCaption);
    expect(enforced.withinLimit).toBe(false);
    expect(enforced.charCount).toBeGreaterThan(CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT);
  });

  it("still fits captions within the repurpose limit for explicit repurpose flows", () => {
    const fitted = fitCaptionForRepurpose("X".repeat(600), ["MatchFit"]);
    expect(fitted.length).toBeLessThan(600);
    expect(fitted.endsWith("…")).toBe(true);
  });

  it("preserves full caption text for operator edits while flagging over-limit posts", () => {
    const longCaption = "B".repeat(600);
    const normalized = normalizeUserEditedPostContent({
      caption: longCaption,
      hashtags: ["MatchFit", "Beta"],
    });

    expect(normalized.caption).toBe(longCaption);
    expect(normalized.withinLimit).toBe(false);
    expect(repurposePostLength(normalized.caption, normalized.hashtags)).toBeGreaterThan(
      CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT,
    );
  });

  it("fits caption around hashtag suffix length", () => {
    const hashtags = ["One", "Two", "Three"];
    const fitted = fitCaptionForRepurpose("X".repeat(520), hashtags);
    const suffix = `\n\n#One #Two #Three`;
    expect(fitted.length + suffix.length).toBeLessThanOrEqual(CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT + 1);
  });

  it("preserves /trainer/signup URLs when rewriting trainer language", () => {
    const caption =
      "Verified trainers should join Match Fit at match-fit.net/trainer/signup and start onboarding.";
    const enforced = enforceGeneratedPostContent({
      caption,
      hashtags: ["MatchFit"],
    });

    expect(enforced.caption).toContain("match-fit.net/trainer/signup");
    expect(enforced.caption).not.toContain("match-fit.net/Fitness Pro/signup");
    expect(enforced.caption).toContain("Fitness Pros");
  });

  it("repairs broken Fitness Pro signup URLs back to /trainer/signup", () => {
    const normalized = normalizeUserEditedPostContent({
      caption: "Join as a Fitness Pro at match-fit.net/Fitness Pro/signup today.",
      hashtags: [],
    });

    expect(normalized.caption).toBe("Join as a Fitness Pro at match-fit.net/trainer/signup today.");
  });
});
