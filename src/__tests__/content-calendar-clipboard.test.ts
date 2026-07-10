import { describe, expect, it } from "vitest";
import {
  buildCaptionWithHashtags,
  formatHashtagsForClipboard,
  hashtagsToInputValue,
  parseHashtagsInput,
  sanitizeHashtagDraftToken,
} from "@/lib/content-calendar/content-calendar-clipboard";

describe("content-calendar clipboard helpers", () => {
  it("parses and normalizes up to five hashtags", () => {
    expect(parseHashtagsInput("MatchFit\n#FitnessApp, beta\nextra")).toEqual([
      "MatchFit",
      "FitnessApp",
      "beta",
      "extra",
    ]);
    expect(
      parseHashtagsInput("one, two, three, four, five, six, seven"),
    ).toEqual(["one", "two", "three", "four", "five"]);
  });

  it("builds caption with hashtags for copy post", () => {
    expect(buildCaptionWithHashtags("Hello coaches", ["MatchFit", "Beta"])).toBe(
      "Hello coaches\n\n#MatchFit #Beta",
    );
  });

  it("formats hashtags for clipboard copy", () => {
    expect(formatHashtagsForClipboard(["MatchFit", "Beta"])).toBe("#MatchFit #Beta");
  });

  it("round-trips hashtag input", () => {
    const tags = ["One", "Two"];
    expect(hashtagsToInputValue(tags)).toBe("One\nTwo");
  });

  it("sanitizes draft hashtag tokens", () => {
    expect(sanitizeHashtagDraftToken("  #MatchFit  ")).toBe("MatchFit");
    expect(sanitizeHashtagDraftToken("   ")).toBeNull();
  });
});
