import { describe, expect, it } from "vitest";
import { formatAdminStatsTimestamp } from "@/lib/admin-stats-timestamp";

describe("formatAdminStatsTimestamp", () => {
  it("formats UTC timestamp", () => {
    const label = formatAdminStatsTimestamp("2026-06-05T15:30:00.000Z");
    expect(label).toContain("UTC");
    expect(label).toContain("2026");
  });

  it("returns Unknown for invalid input", () => {
    expect(formatAdminStatsTimestamp("not-a-date")).toBe("Unknown");
  });
});
