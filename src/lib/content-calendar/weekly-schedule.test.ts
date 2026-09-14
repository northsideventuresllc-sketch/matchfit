import { describe, expect, it } from "vitest";
import {
  CONTENT_CALENDAR_WEEKDAY_POST_TYPES,
  CONTENT_CALENDAR_WEEKDAY_SCHEDULE,
} from "@/lib/content-calendar/constants";
import {
  getScheduleRuleForDate,
  getWeekdayIndexForDate,
} from "@/app/admin/content-calendar/v2/components/helpers";

describe("Weekly Posting Schedule & Theme Rules", () => {
  it("defines all 5 weekdays (0..4) with locked post formats", () => {
    // Mon / Wed / Fri: Video + Carousel (or Carousel + Video)
    expect([...CONTENT_CALENDAR_WEEKDAY_POST_TYPES[0]].sort()).toEqual(["Carousel", "Video"]);
    expect([...CONTENT_CALENDAR_WEEKDAY_POST_TYPES[2]].sort()).toEqual(["Carousel", "Video"]);
    expect([...CONTENT_CALENDAR_WEEKDAY_POST_TYPES[4]].sort()).toEqual(["Carousel", "Video"]);

    // Tue / Thu: Static + Text
    expect([...CONTENT_CALENDAR_WEEKDAY_POST_TYPES[1]].sort()).toEqual(["Static", "Text"]);
    expect([...CONTENT_CALENDAR_WEEKDAY_POST_TYPES[3]].sort()).toEqual(["Static", "Text"]);
  });

  it("assigns the locked audience themes to Monday, Wednesday, and Friday", () => {
    // Mon = Join Our Team (Join the Team)
    expect(CONTENT_CALENDAR_WEEKDAY_SCHEDULE[0].theme).toBe("Join Our Team");
    expect(CONTENT_CALENDAR_WEEKDAY_SCHEDULE[0].targetGroup).toBe("Join the Team");
    expect(CONTENT_CALENDAR_WEEKDAY_SCHEDULE[0].isLivePostingDay).toBe(true);

    // Wed = Client (Clients)
    expect(CONTENT_CALENDAR_WEEKDAY_SCHEDULE[2].theme).toContain("Client");
    expect(CONTENT_CALENDAR_WEEKDAY_SCHEDULE[2].targetGroup).toBe("Clients");
    expect(CONTENT_CALENDAR_WEEKDAY_SCHEDULE[2].isLivePostingDay).toBe(true);

    // Fri = List With Us
    expect(CONTENT_CALENDAR_WEEKDAY_SCHEDULE[4].theme).toBe("List With Us");
    expect(CONTENT_CALENDAR_WEEKDAY_SCHEDULE[4].targetGroup).toBe("List With Us");
    expect(CONTENT_CALENDAR_WEEKDAY_SCHEDULE[4].isLivePostingDay).toBe(true);
  });

  it("correctly resolves weekday index and schedule rule from date string", () => {
    // 2026-09-14 is a Monday
    expect(getWeekdayIndexForDate("2026-09-14")).toBe(0);
    const monRule = getScheduleRuleForDate("2026-09-14");
    expect(monRule?.theme).toBe("Join Our Team");
    expect(monRule?.targetGroup).toBe("Join the Team");
    expect(monRule?.isLivePostingDay).toBe(true);

    // 2026-09-16 is a Wednesday
    expect(getWeekdayIndexForDate("2026-09-16")).toBe(2);
    const wedRule = getScheduleRuleForDate("2026-09-16");
    expect(wedRule?.targetGroup).toBe("Clients");
    expect(wedRule?.isLivePostingDay).toBe(true);

    // 2026-09-18 is a Friday
    expect(getWeekdayIndexForDate("2026-09-18")).toBe(4);
    const friRule = getScheduleRuleForDate("2026-09-18");
    expect(friRule?.theme).toBe("List With Us");
    expect(friRule?.isLivePostingDay).toBe(true);

    // 2026-09-15 is a Tuesday (Draft / Feature day)
    expect(getWeekdayIndexForDate("2026-09-15")).toBe(1);
    const tueRule = getScheduleRuleForDate("2026-09-15");
    expect(tueRule?.isLivePostingDay).toBe(false);
    expect(tueRule?.postTypes).toEqual(["Static", "Text"]);
  });
});
