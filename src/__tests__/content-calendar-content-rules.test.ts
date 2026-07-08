import { describe, expect, it } from "vitest";
import {
  CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT,
  enforceGeneratedPostContent,
  fitCaptionForRepurpose,
  normalizeUserEditedPostContent,
  repurposePostLength,
} from "@/lib/content-calendar/content-rules";

describe("content-calendar content rules", () => {
  it("truncates AI-generated captions to fit the repurpose limit", () => {
    const longCaption = "A".repeat(600);
    const enforced = enforceGeneratedPostContent({
      caption: longCaption,
      hashtags: ["MatchFit"],
    });

    expect(enforced.withinLimit).toBe(true);
    expect(enforced.caption.length).toBeLessThan(longCaption.length);
    expect(enforced.caption.endsWith("…")).toBe(true);
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
});
