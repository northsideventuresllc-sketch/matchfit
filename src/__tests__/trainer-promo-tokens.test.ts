import { describe, expect, it } from "vitest";
import { newYorkIsoWeekKey, promotionRegionalFeedBoost } from "@/lib/trainer-promo-tokens";

describe("trainer promo tokens", () => {
  it("regional boost is zero when ZIP prefix mismatches", () => {
    expect(promotionRegionalFeedBoost(100, 5, "100", "902")).toBe(0);
    expect(promotionRegionalFeedBoost(100, 5, "100", null)).toBe(0);
  });

  it("regional boost is positive when ZIP prefix matches", () => {
    const b = promotionRegionalFeedBoost(100, 5, "100", "100");
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThanOrEqual(160);
  });

  it("week key has expected shape", () => {
    const k = newYorkIsoWeekKey(new Date("2026-04-28T12:00:00Z"));
    expect(k).toMatch(/^\d{4}-W\d{2}$/);
  });
});
