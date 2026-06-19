import { describe, expect, it } from "vitest";
import {
  CONTENT_CALENDAR_MAX_HASHTAGS,
  CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT,
  enforceGeneratedPostContent,
  fitCaptionForRepurpose,
  normalizeFitnessProLanguage,
  normalizeHashtags,
  normalizeTargetGroup,
  repurposePostLength,
} from "@/lib/content-calendar/content-rules";
import { getContentCalendarRotation } from "@/lib/content-calendar/rotation";

describe("getContentCalendarRotation", () => {
  it("rotates Fitness Pros and Clients across post types with offset", () => {
    const base = getContentCalendarRotation(0, 1);
    expect(base.Carousel).toBe("Clients");
    expect(base.Static).toBe("Fitness Pros");
    expect(base.Video).toBe("Clients");
    expect(base.Text).toBe("Fitness Pros");
  });

  it("advances audiences by weekday index", () => {
    const mon = getContentCalendarRotation(0, 0);
    const tue = getContentCalendarRotation(1, 0);
    expect(mon.Carousel).toBe("Fitness Pros");
    expect(tue.Carousel).toBe("Clients");
  });
});

describe("content-rules", () => {
  it("maps legacy audience labels to Fitness Pros or Clients", () => {
    expect(normalizeTargetGroup("Atlanta Trainers")).toBe("Fitness Pros");
    expect(normalizeTargetGroup("Virtual Clients")).toBe("Clients");
  });

  it("caps hashtags at five", () => {
    expect(normalizeHashtags(["a", "b", "c", "d", "e", "f"])).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("normalizes trainer language to Fitness Pros", () => {
    expect(normalizeFitnessProLanguage("Atlanta trainers wanted")).toBe("Atlanta Fitness Pros wanted");
  });

  it("fits caption within repurpose limit including hashtags", () => {
    const hashtags = ["MatchFit", "Beta"];
    const longCaption = "x".repeat(CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT);
    const fitted = fitCaptionForRepurpose(longCaption, hashtags);
    expect(repurposePostLength(fitted, hashtags)).toBeLessThanOrEqual(CONTENT_CALENDAR_REPURPOSE_CHAR_LIMIT);
  });

  it("enforces generated post content rules", () => {
    const result = enforceGeneratedPostContent({
      caption: "Join our trainers today!",
      hashtags: ["one", "two", "three", "four", "five", "six"],
    });
    expect(result.hashtags).toHaveLength(CONTENT_CALENDAR_MAX_HASHTAGS);
    expect(result.caption).toContain("Fitness Pros");
    expect(result.withinLimit).toBe(true);
  });
});
