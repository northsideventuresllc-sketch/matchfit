import { describe, expect, it } from "vitest";
import { getContentCalendarRotation } from "@/lib/content-calendar/rotation";
import {
  estDateString,
  isPostMissed,
  shouldShowMissedPrompt,
} from "@/lib/content-calendar/schedule-utils";

describe("getContentCalendarRotation", () => {
  it("rotates four target groups across post types with offset", () => {
    const base = getContentCalendarRotation(0, 7);
    expect(base.Carousel).toBe("Clients");
    expect(base.Static).toBe("Fitness Pros");
    expect(base.Video).toBe("Clients");
    expect(base.Text).toBe("Fitness Pros");
  });

  it("advances groups by weekday index", () => {
    const mon = getContentCalendarRotation(0, 0);
    const tue = getContentCalendarRotation(1, 0);
    expect(mon.Carousel).toBe("Fitness Pros");
    expect(tue.Carousel).toBe("Clients");
  });
});

describe("schedule-utils EST missed posts", () => {
  it("marks post missed after 11:59pm EST on scheduled date", () => {
    const postDate = "2026-06-02";
    const beforeDeadline = new Date("2026-06-03T03:59:00.000Z");
    const afterDeadline = new Date("2026-06-03T04:01:00.000Z");
    expect(isPostMissed({ postDate, posted: false, now: beforeDeadline })).toBe(false);
    expect(isPostMissed({ postDate, posted: false, now: afterDeadline })).toBe(true);
    expect(isPostMissed({ postDate, posted: true, now: afterDeadline })).toBe(false);
  });

  it("shows missed prompt on the calendar day after the scheduled post date", () => {
    const postDate = "2026-06-02";
    const beforeDeadline = new Date("2026-06-03T03:30:00.000Z");
    const nextDay = new Date("2026-06-04T05:00:00.000Z");
    expect(
      shouldShowMissedPrompt({
        postDate,
        posted: false,
        missedPromptDismissed: false,
        now: beforeDeadline,
      }),
    ).toBe(false);
    expect(
      shouldShowMissedPrompt({
        postDate,
        posted: false,
        missedPromptDismissed: false,
        now: nextDay,
      }),
    ).toBe(true);
  });

  it("formats EST calendar date", () => {
    const d = new Date("2026-06-03T15:00:00.000Z");
    expect(estDateString(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
