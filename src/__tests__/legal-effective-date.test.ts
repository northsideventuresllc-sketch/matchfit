import { describe, expect, it } from "vitest";
import {
  LEGAL_EFFECTIVE_DATE_DISPLAY,
  LEGAL_EFFECTIVE_DATE_LONG,
} from "@/lib/legal-effective-date";

describe("legal-effective-date constants", () => {
  it("keeps the short effective date in M.DD.YY format", () => {
    expect(LEGAL_EFFECTIVE_DATE_DISPLAY).toMatch(/^\d{1,2}\.\d{2}\.\d{2}$/);
  });

  it("keeps short and long forms aligned to the same calendar date", () => {
    const [month, day, yearTwoDigits] = LEGAL_EFFECTIVE_DATE_DISPLAY.split(".").map(Number);
    const expectedYear = 2000 + yearTwoDigits;
    const longFormDate = new Date(`${LEGAL_EFFECTIVE_DATE_LONG} UTC`);

    expect(longFormDate.getUTCFullYear()).toBe(expectedYear);
    expect(longFormDate.getUTCMonth() + 1).toBe(month);
    expect(longFormDate.getUTCDate()).toBe(day);
  });
});
