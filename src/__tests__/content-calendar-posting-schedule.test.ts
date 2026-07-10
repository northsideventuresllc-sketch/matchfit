import { describe, expect, it } from "vitest";
import { getSocialPostingDateKeys } from "@/lib/content-calendar/posting-schedule";

describe("getSocialPostingDateKeys", () => {
  it("starts on Friday then Monday when generating Thursday after 5pm Eastern", () => {
    // Thu 2026-06-04 6:30pm America/New_York (EDT, UTC-4)
    const now = new Date("2026-06-04T22:30:00.000Z");
    expect(getSocialPostingDateKeys({ count: 2, now })).toEqual(["2026-06-05", "2026-06-08"]);
  });

  it("allows same-day Monday slot before 5pm Eastern", () => {
    // Mon 2026-06-08 3:00pm America/New_York (EDT)
    const now = new Date("2026-06-08T19:00:00.000Z");
    expect(getSocialPostingDateKeys({ count: 2, now })).toEqual(["2026-06-08", "2026-06-10"]);
  });

  it("rolls Monday evening to Wednesday", () => {
    // Mon 2026-06-08 6:30pm America/New_York (EDT)
    const now = new Date("2026-06-08T22:30:00.000Z");
    expect(getSocialPostingDateKeys({ count: 2, now })).toEqual(["2026-06-10", "2026-06-12"]);
  });
});
