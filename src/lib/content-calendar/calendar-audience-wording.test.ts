import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CONTENT_CALENDAR_WEEKDAY_SCHEDULE } from "@/lib/content-calendar/constants";

describe("content calendar audience wording", () => {
  it("calendar audience notes use Fitness Pros and carry no Atlanta targeting", () => {
    const src = readFileSync(join(process.cwd(), "content/social/matchfit-content-calendar.jsx"), "utf8");
    const block = src.slice(
      src.indexOf("MATCHFIT_CONTENT_AUDIENCE_DESCRIPTIONS"),
      src.indexOf("MATCHFIT_CONTENT_RULES"),
    );
    expect(block).not.toMatch(/trainers/i);
    expect(block).toContain("Fitness Pros");
    expect(src).not.toMatch(/atlanta/i); // geo-guard:allow
  });

  it("weekday audience descriptions never label the audience 'trainers'", () => {
    for (const rule of Object.values(CONTENT_CALENDAR_WEEKDAY_SCHEDULE)) {
      expect(rule.audienceDescription).not.toMatch(/\btrainers\b/i);
    }
  });
});
